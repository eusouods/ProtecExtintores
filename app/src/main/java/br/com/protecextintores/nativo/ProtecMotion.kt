package br.com.protecextintores.nativo

import android.view.WindowManager
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider

internal val WebEaseOut = CubicBezierEasing(.22f, 1f, .36f, 1f)
internal val WebEaseSpring = CubicBezierEasing(.3f, 1.35f, .5f, 1f)
internal val WebTeamEase = CubicBezierEasing(.2f, .75f, .2f, 1f)
internal val WebTeamPillEase = CubicBezierEasing(.2f, .8f, .25f, 1f)
internal val WebEase = CubicBezierEasing(.25f, .1f, .25f, 1f)
internal val WebCountEase = CubicBezierEasing(.333333f, 1f, .666667f, 1f)

internal val LocalProtecDialogStack = staticCompositionLocalOf<SnapshotStateList<Any>?> { null }
internal val LocalProtecDialogFeedback = staticCompositionLocalOf<@Composable () -> Unit> { {} }
internal val LocalTeamPanel = staticCompositionLocalOf { false }

@Composable
internal fun WebRise(
    duration: Int,
    distance: Dp,
    delayMillis: Int = 0,
    play: Boolean = true,
    startAlpha: Float = 0f,
    easing: Easing = WebEaseOut,
    content: @Composable () -> Unit
) {
    if (!play) {
        content()
        return
    }
    val progress = remember { Animatable(0f) }
    LaunchedEffect(progress) {
        progress.animateTo(1f, tween(duration, delayMillis, easing))
    }
    Box(Modifier.graphicsLayer {
        val value = progress.value
        alpha = startAlpha + (1f - startAlpha) * value
        translationY = distance.toPx() * (1f - value)
    }) { content() }
}

@Composable
internal fun ProtecDialog(
    onDismissRequest: () -> Unit,
    confirmButton: @Composable () -> Unit,
    title: @Composable () -> Unit,
    text: @Composable () -> Unit,
    dismissButton: (@Composable () -> Unit)? = null,
    scrollBody: Boolean = true
) {
    ProtecSheet(onDismissRequest = onDismissRequest) {
        val colors = MaterialTheme.colorScheme
        Box(Modifier.fillMaxWidth().padding(16.dp)) {
            ProvideTextStyle(MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold), title)
        }
        HorizontalDivider(color = colors.outline)
        // Lists and other scrollable bodies need the sheet's finite height.
        val scroll = if (scrollBody) Modifier.verticalScroll(rememberScrollState()) else Modifier
        Column(Modifier.fillMaxWidth().weight(1f, fill = false).then(scroll).padding(16.dp)) {
            ProvideTextStyle(MaterialTheme.typography.bodyMedium, text)
        }
        HorizontalDivider(color = colors.outline)
        FlowRow(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            dismissButton?.invoke()
            confirmButton()
        }
    }
}

@Composable
internal fun ProtecSheet(
    onDismissRequest: () -> Unit,
    navigation: Boolean = false,
    content: @Composable ColumnScope.() -> Unit
) {
    val overlays = LocalProtecDialogStack.current
    val marker = remember { Any() }
    DisposableEffect(overlays, marker) {
        overlays?.add(marker)
        onDispose { overlays?.remove(marker) }
    }
    val covered = overlays?.lastOrNull()?.let { it !== marker } == true
    val coveredBlur by animateDpAsState(if (covered) 8.dp else 0.dp, tween(200, easing = WebEase), label = "Desfoque da janela anterior")
    val colors = MaterialTheme.colorScheme
    Dialog(
        onDismissRequest = onDismissRequest,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)
    ) {
        val window = (LocalView.current.parent as? DialogWindowProvider)?.window
        SideEffect { window?.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND) }
        val scrim = remember { Animatable(0f) }
        val panel = remember { Animatable(0f) }
        LaunchedEffect(scrim) { scrim.animateTo(1f, tween(200, easing = WebEase)) }
        LaunchedEffect(panel, navigation) {
            panel.animateTo(1f, tween(if (navigation) 260 else 340, easing = if (navigation) WebTeamEase else WebEaseOut))
        }
        Box(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxSize()
                .graphicsLayer { alpha = scrim.value }
                .background(colors.scrim.copy(alpha = .4f))
                .clickable(remember { MutableInteractionSource() }, indication = null, onClick = onDismissRequest)
                .clearAndSetSemantics {})
            BoxWithConstraints(
                Modifier.fillMaxSize().safeDrawingPadding()
                    .padding(if (navigation) PaddingValues(start = 12.dp, end = 12.dp, bottom = 9.dp) else PaddingValues(0.dp))
                    .clipToBounds(),
                contentAlignment = Alignment.BottomCenter
            ) {
                val maxSheetHeight = if (navigation) maxHeight * .85f else maxHeight
                Surface(
                    modifier = Modifier.widthIn(max = 650.dp).fillMaxWidth().heightIn(max = maxSheetHeight)
                        .graphicsLayer {
                            val value = panel.value
                            alpha = if (navigation) .35f + .65f * value else value
                            translationY = (if (navigation) 28.dp else 32.dp).toPx() * (1f - value)
                        }
                        .blur(coveredBlur)
                        .pointerInput(Unit) { detectTapGestures {} },
                    shape = if (navigation) RoundedCornerShape(17.dp) else RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
                    color = colors.surface,
                    border = BorderStroke(1.dp, colors.outline)
                ) {
                    Column(content = content)
                }
            }
            if (overlays?.lastOrNull() === marker) {
                Box(Modifier.fillMaxSize().safeDrawingPadding().clipToBounds()) { LocalProtecDialogFeedback.current() }
            }
        }
    }
}
