package br.com.protecextintores.nativo

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.content.FileProvider
import java.io.File

class MainActivity : ComponentActivity() {
    private val vm: AppVm by viewModels()

    private val capture = registerForActivityResult(ActivityResultContracts.CaptureVideo()) { ok ->
        if (ok) vm.videoCaptured() else vm.videoCancelled()
    }

    private val pick = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) vm.videoPicked(uri)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Store.init(applicationContext)
        enableEdgeToEdge()
        setContent {
            ProtecTheme(vm.themeMode) {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    AppRoot(vm, onRecord = { key -> record(key) }, onPick = { key -> pickVideo(key) })
                }
            }
        }
    }

    private fun record(key: String) {
        val dir = File(cacheDir, "videos").apply { mkdirs() }
        val file = File(dir, "cap-" + System.currentTimeMillis() + ".mp4")
        vm.beginVideo(key, file)
        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
        capture.launch(uri)
    }

    private fun pickVideo(key: String) {
        vm.beginVideo(key, null)
        pick.launch("video/*")
    }
}
