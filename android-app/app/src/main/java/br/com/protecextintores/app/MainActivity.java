package br.com.protecextintores.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.SafeBrowsingResponse;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
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

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startUrl = getString(R.string.start_url);
        websiteHost = Uri.parse(startUrl).getHost();
        getWindow().setStatusBarColor(android.graphics.Color.rgb(23, 24, 18));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(23, 24, 18));
        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setIndeterminate(false);
        progressBar.setProgressTintList(android.content.res.ColorStateList.valueOf(0xFFF4C400));
        progressBar.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(0x00171812));

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

        webView.setBackgroundColor(0xFFF8F5E8);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                if (("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme))
                        && websiteHost != null && websiteHost.equalsIgnoreCase(uri.getHost())) {
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
                        return false;
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
        panel.setBackgroundColor(android.graphics.Color.WHITE);

        TextView title = new TextView(this);
        title.setText("Não foi possível abrir a ProtecExtintores");
        title.setTextColor(android.graphics.Color.rgb(29, 16, 14));
        title.setTextSize(20);
        title.setGravity(android.view.Gravity.CENTER);
        panel.addView(title, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        TextView details = new TextView(this);
        details.setTag("load-error-details");
        details.setTextColor(android.graphics.Color.rgb(109, 94, 89));
        details.setTextSize(15);
        details.setGravity(android.view.Gravity.CENTER);
        LinearLayout.LayoutParams detailsParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        detailsParams.setMargins(0, dp(12), 0, dp(18));
        panel.addView(details, detailsParams);

        Button retry = new Button(this);
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
}
