package br.com.protecextintores.nativo

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
internal fun Modifier.webPress(source: MutableInteractionSource, pressedScale: Float = .96f): Modifier {
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) pressedScale else 1f,
        tween(if (pressed) 80 else 200, easing = WebEase), label = "Pressão do toque")
    return graphicsLayer { scaleX = scale; scaleY = scale }
}

@Composable
fun PrimaryButton(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    Button(
        onClick = onClick,
        enabled = enabled,
        interactionSource = source,
        shape = RoundedCornerShape(10.dp),
        modifier = modifier.fillMaxWidth().heightIn(min = 44.dp).webPress(source)
    ) {
        Text(text, fontWeight = FontWeight.ExtraBold)
    }
}

@Composable
fun SoftButton(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    val colors = MaterialTheme.colorScheme
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        interactionSource = source,
        shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = colors.surface, contentColor = colors.onSurface),
        border = BorderStroke(1.dp, if (enabled) colors.outlineVariant else colors.outline),
        modifier = modifier.heightIn(min = 44.dp).webPress(source)
    ) {
        Text(text, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun CardBox(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp), content = content)
    }
}

@Composable
fun StatusChip(status: String) {
    val done = status == "Aguardando revisão" || status == "Finalizado" || status == "Concluído"
    val background = if (done) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
    val foreground = if (done) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
    Surface(shape = RoundedCornerShape(999.dp), color = background) {
        Text(
            status,
            color = foreground,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp)
        )
    }
}

@Composable
fun ScreenHeader(title: String, onBack: (() -> Unit)? = null) {
    val colors = MaterialTheme.colorScheme
    Surface(color = colors.surface) {
        Column {
            Row(
                Modifier.fillMaxWidth().heightIn(min = 62.dp).padding(start = 16.dp, end = 8.dp, top = 5.dp, bottom = 5.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(title, Modifier.weight(1f), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                if (onBack != null) IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Voltar" }) {
                    PanelGlyph(PanelIcon.Close, colors.onSurface, 20.dp)
                }
            }
            HorizontalDivider(color = colors.outline)
        }
    }
}

@Composable
fun BusyOverlay(visible: Boolean, text: String) {
    AnimatedVisibility(visible = visible, enter = fadeIn(), exit = fadeOut()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.45f))
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = {}),
            contentAlignment = Alignment.Center
        ) {
            Surface(shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface) {
                Column(modifier = Modifier.padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    CircularProgressIndicator()
                    Text(text.ifEmpty { "Aguarde…" }, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}
