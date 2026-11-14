package br.com.protecextintores.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.os.Build;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import androidx.webkit.ServiceWorkerControllerCompat;
import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.WebViewFeature;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final int FILE_PICKER_REQUEST = 7214;

    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> fileChooserCallback;
    private String startUrl;
    private String websiteHost;
    private LinearLayout loadErrorView;
    private OfflineBridge offlineBridge;
    private boolean bundledFallback;
    private FrameLayout appRoot;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startUrl = getString(R.string.start_url);
        websiteHost = Uri.parse(startUrl).getHost();
        FrameLayout root = new FrameLayout(this);
        appRoot = root;
        root.setBackgroundColor(getColor(R.color.protec_background));
        // Android 15 draws under system bars. Keep forms and navigation tappable.
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        webView = new WebView(this);
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setIndeterminate(false);
        progressBar.setProgressTintList(android.content.res.ColorStateList.valueOf(getColor(R.color.protec_primary)));
        progressBar.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(0x001D1815));

        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, dp(3), android.view.Gravity.TOP);
        root.addView(progressBar, progressParams);
        loadErrorView = createLoadErrorView();
        loadErrorView.setVisibility(View.GONE);
        FrameLayout.LayoutParams errorParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT,
                android.view.Gravity.CENTER);
        errorParams.setMargins(dp(24), dp(24), dp(24), dp(24));
        root.addView(loadErrorView, errorParams);
        setContentView(root);

        configureWebView();
        boolean systemDark=(getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK)==android.content.res.Configuration.UI_MODE_NIGHT_YES;
        applyAppearance(getSharedPreferences("protec-appearance",MODE_PRIVATE).getString("mode",systemDark?"dark":"light"));
        offlineBridge = new OfflineBridge(this, webView);
        if (savedInstanceState != null && webView.restoreState(savedInstanceState) != null) {
            // The WebView restored its current page and navigation history.
        } else {
            webView.loadUrl(startUrl);
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);

        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(new ServiceWorkerClientCompat() {
                @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                    return bundledPage(request.getUrl());
                }
            });
        }

        webView.setBackgroundColor(getColor(R.color.protec_background));
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return bundledPage(request.getUrl());
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                String sitePath = Uri.parse(startUrl).getPath();
                String requestedPath = uri.getPath();
                if ("https".equalsIgnoreCase(scheme)
                        && websiteHost != null && websiteHost.equalsIgnoreCase(uri.getHost())
                        && uri.getPort() == -1 && requestedPath != null
                        && requestedPath.startsWith(sitePath)) {
                    return false;
                }
                if ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)
                        || "mailto".equalsIgnoreCase(scheme) || "tel".equalsIgnoreCase(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (ActivityNotFoundException ignored) {
                        Toast.makeText(MainActivity.this, "Não há aplicativo para abrir este link.", Toast.LENGTH_SHORT).show();
                    }
                    return true;
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                loadErrorView.setVisibility(View.GONE);
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && !bundledFallback && websiteHost.equals(request.getUrl().getHost())) {
                    bundledFallback = true;
                    view.post(() -> view.loadUrl(request.getUrl().toString()));
                    return;
                }
                if (request.isForMainFrame()) showLoadError("Não foi possível abrir o site. " + error.getDescription());
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request,
                                            android.webkit.WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) {
                    showLoadError("O site respondeu com erro " + response.getStatusCode()
                            + ". Confira se a publicação do GitHub Pages está concluída.");
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                showLoadError("A conexão segura do site não pôde ser confirmada. Confira a data e hora do aparelho ou tente novamente mais tarde.");
            }

        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int progress) {
                progressBar.setProgress(progress);
                progressBar.setVisibility(progress >= 100 ? View.GONE : View.VISIBLE);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    startActivityForResult(Intent.createChooser(intent, "Selecionar vídeo ou arquivo"), FILE_PICKER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException error) {
                    Intent fallback = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    fallback.addCategory(Intent.CATEGORY_OPENABLE);
                    fallback.setType("*/*");
                    try {
                        startActivityForResult(Intent.createChooser(fallback, "Selecionar vídeo ou arquivo"), FILE_PICKER_REQUEST);
                        return true;
                    } catch (ActivityNotFoundException noPicker) {
                        fileChooserCallback = null;
                        callback.onReceiveValue(null);
                        Toast.makeText(MainActivity.this, "Não foi possível abrir os arquivos neste aparelho.", Toast.LENGTH_SHORT).show();
                        return true;
                    }
                }
            }
        });
    }

    private LinearLayout createLoadErrorView() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(android.view.Gravity.CENTER);
        panel.setPadding(dp(24), dp(24), dp(24), dp(24));
        panel.setBackgroundColor(getColor(R.color.protec_surface));

        ImageView companyLogo = new ImageView(this);
        companyLogo.setImageResource(getApplicationInfo().icon);
        companyLogo.setContentDescription("ProtecExtintores");
        companyLogo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(76), dp(76));
        logoParams.setMargins(0, 0, 0, dp(20));
        panel.addView(companyLogo, logoParams);

        TextView title = new TextView(this);
        title.setTag("load-error-title");
        title.setText("Não foi possível abrir a ProtecExtintores");
        title.setTextColor(getColor(R.color.protec_text));
        title.setTextSize(20);
        title.setGravity(android.view.Gravity.CENTER);
        panel.addView(title, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        TextView details = new TextView(this);
        details.setTag("load-error-details");
        details.setTextColor(getColor(R.color.protec_muted));
        details.setTextSize(15);
        details.setGravity(android.view.Gravity.CENTER);
        LinearLayout.LayoutParams detailsParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        detailsParams.setMargins(0, dp(12), 0, dp(18));
        panel.addView(details, detailsParams);

        Button retry = new Button(this);
        retry.setTextColor(getColor(R.color.protec_on_primary));
        retry.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getColor(R.color.protec_primary)));
        retry.setText("Tentar novamente");
        retry.setOnClickListener(view -> webView.loadUrl(startUrl));
        panel.addView(retry, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        return panel;
    }

    private void showLoadError(String message) {
        if (loadErrorView == null) return;
        TextView details = loadErrorView.findViewWithTag("load-error-details");
        if (details != null) details.setText(message + "\n\nEndereço: " + startUrl);
        loadErrorView.setVisibility(View.VISIBLE);
        progressBar.setVisibility(View.GONE);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (offlineBridge != null && offlineBridge.activityResult(requestCode, resultCode)) return;
        if (requestCode != FILE_PICKER_REQUEST || fileChooserCallback == null) return;
        Uri[] selected = null;
        if (resultCode == Activity.RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                selected = new Uri[count];
                for (int i = 0; i < count; i++) selected[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                selected = new Uri[]{data.getData()};
            }
        }
        fileChooserCallback.onReceiveValue(selected);
        fileChooserCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (offlineBridge != null) offlineBridge.destroy();
        if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    /** Match the website's selected theme, including Android 15 system-bar insets. */
    public void applyAppearance(String mode) {
        if (!"light".equals(mode) && !"dark".equals(mode)) return;
        boolean dark="dark".equals(mode);
        int background=android.graphics.Color.parseColor(dark?"#1D1815":"#EDF4FA");
        int panel=android.graphics.Color.parseColor(dark?"#29211C":"#F9FCFF");
        int text=android.graphics.Color.parseColor(dark?"#F5E9DC":"#20374A");
        int muted=android.graphics.Color.parseColor(dark?"#C7B09B":"#526B80");
        int action=android.graphics.Color.parseColor(dark?"#E7AA74":"#226B99");
        int onAction=android.graphics.Color.parseColor(dark?"#2C1D12":"#FFFFFF");
        getSharedPreferences("protec-appearance",MODE_PRIVATE).edit().putString("mode",mode).apply();
        getWindow().setStatusBarColor(background);
        getWindow().setNavigationBarColor(!dark && Build.VERSION.SDK_INT<26?android.graphics.Color.parseColor("#20374A"):background);
        int flags=getWindow().getDecorView().getSystemUiVisibility();
        flags=dark?flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR:flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if(Build.VERSION.SDK_INT>=26)flags=dark?flags & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR:flags | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        getWindow().getDecorView().setSystemUiVisibility(flags);
        if(appRoot!=null)appRoot.setBackgroundColor(background);
        if(webView!=null)webView.setBackgroundColor(background);
        if(progressBar!=null)progressBar.setProgressTintList(android.content.res.ColorStateList.valueOf(action));
        if(loadErrorView!=null){loadErrorView.setBackgroundColor(panel);for(int i=0;i<loadErrorView.getChildCount();i++){View child=loadErrorView.getChildAt(i);if(child instanceof Button){((Button)child).setTextColor(onAction);child.setBackgroundTintList(android.content.res.ColorStateList.valueOf(action));}else if(child instanceof TextView)((TextView)child).setTextColor("load-error-title".equals(child.getTag())?text:muted);}}
    }

    private boolean connected() {
        ConnectivityManager manager=(ConnectivityManager)getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkCapabilities capabilities=manager==null?null:manager.getNetworkCapabilities(manager.getActiveNetwork());
        return capabilities!=null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }

    private WebResourceResponse bundledPage(Uri uri) {
        if (!bundledFallback && connected()) return null;
        String sitePath=Uri.parse(startUrl).getPath(),requestPath=uri.getPath();
        if (!"https".equals(uri.getScheme()) || !websiteHost.equals(uri.getHost()) || uri.getPort()!=-1 || requestPath==null || !requestPath.startsWith(sitePath)) return null;
        String file=requestPath.substring(sitePath.length());
        if (file.isEmpty() || !file.substring(file.lastIndexOf('/')+1).contains(".")) file="index.html";
        if (file.contains("..") || file.contains("\\")) return null;
        String mime=file.endsWith(".html")?"text/html":file.endsWith(".js")||file.endsWith(".mjs")?"text/javascript":file.endsWith(".css")?"text/css":file.endsWith(".svg")?"image/svg+xml":file.endsWith(".png")?"image/png":file.endsWith(".json")||file.endsWith(".webmanifest")?"application/json":"application/octet-stream";
        try { return new WebResourceResponse(mime,"UTF-8",getAssets().open("site/"+file)); }
        catch (java.io.IOException ignored) { return null; }
    }

    @Override protected void onResume() {
        super.onResume();
        if (offlineBridge != null) offlineBridge.onResume();
    }

    @Override protected void onStop() {
        if (offlineBridge != null) offlineBridge.onStop();
        super.onStop();
    }
}
