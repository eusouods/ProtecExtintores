package br.com.protecextintores.nativo

import android.widget.MediaController
import android.widget.VideoView
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import org.json.JSONObject
import java.io.File
import java.util.UUID

@Composable
internal fun EvidenceLinks(item: JSONObject) {
    val images = item.optJSONObject("replacementMedia") ?: return
    val parts = item.optJSONArray("replacedParts").stringList()
    var selected by remember { mutableStateOf<Pair<String, String>?>(null) }
    for (part in parts) {
        val url = images.optJSONObject(part)?.str("url").orEmpty()
        if (url.isNotEmpty()) TextButton(onClick = { selected = part to url }) {
            Text("Assistir vídeo · $part")
        }
    }
    selected?.let { (part, url) -> EvidenceDialog(part, url) { selected = null } }
}

@Composable
private fun EvidenceDialog(part: String, url: String, close: () -> Unit) {
    val context = LocalContext.current
    val token = Store.token
    val file = remember(url) { File(context.cacheDir, "evidence-" + UUID.randomUUID() + ".mp4") }
    var ready by remember(url) { mutableStateOf<Boolean?>(null) }
    var playbackError by remember(url) { mutableStateOf(false) }
    LaunchedEffect(url, token) { ready = Api.downloadEvidence(token, url, file) }
    DisposableEffect(file) { onDispose { file.delete() } }
    ProtecDialog(onDismissRequest = close, title = { Text(part) }, text = {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            when (ready) {
                null -> CircularProgressIndicator()
                false -> Text("Não foi possível carregar o vídeo. Confira a conexão e o acesso a esta ordem.")
                true -> if (playbackError) Text("O Android não conseguiu reproduzir este arquivo.") else AndroidView(
                    modifier = Modifier.fillMaxWidth().height(250.dp),
                    factory = { ctx ->
                        VideoView(ctx).apply {
                            setMediaController(MediaController(ctx))
                            setOnErrorListener { _, _, _ -> playbackError = true; true }
                            setVideoPath(file.absolutePath)
                            setOnPreparedListener { seekTo(1) }
                        }
                    },
                    onReset = null,
                    onRelease = { it.stopPlayback() }
                )
            }
        }
    }, confirmButton = { TextButton(onClick = close) { Text("Fechar") } })
}
