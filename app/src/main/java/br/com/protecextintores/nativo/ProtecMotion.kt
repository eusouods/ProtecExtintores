package br.com.protecextintores.nativo

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

internal val WebEaseOut = CubicBezierEasing(.22f, 1f, .36f, 1f)
internal val WebTeamPillEase = CubicBezierEasing(.2f, .8f, .25f, 1f)
private val MoreEnterEase = CubicBezierEasing(.24f, .88f, .26f, 1f)
private val MoreExitEase = CubicBezierEasing(.4f, 0f, .75f, .25f)
internal val PanelPageEase = CubicBezierEasing(.18f, .8f, .25f, 1f)
internal val WebEase = CubicBezierEasing(.25f, .1f, .25f, 1f)
internal val WebCountEase = CubicBezierEasing(.333333f, 1f, .666667f, 1f)

internal class ProtecSheetEntry(val render: @Composable (Boolean) -> Unit)

internal val LocalProtecSheets = staticCompositionLocalOf<SnapshotStateList<ProtecSheetEntry>> {
    error("ProtecSheet requires the app's sheet host")
}
internal val LocalTeamPanel = staticCompositionLocalOf { false }

internal fun Modifier.hideCoveredContent(covered: Boolean): Modifier =
    if (covered) clearAndSetSemantics {} else this

internal data class SheetOption(val value: String, val label: String = value, val enabled: Boolean = true)

@Composable
internal fun ProtecOptions(label: String, options: List<SheetOption>, selected: String?, close: () -> Unit, choose: (String) -> Unit) {
    var search by rememberSaveable { mutableStateOf("") }
    ProtecDialog(
        onDismissRequest = close,
        title = { Text(label) },
        text = {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                if (options.size > 12) PanelSearch(search, { search = it }, "Buscar")
                val shown = options.filter { it.label.contains(search.trim(), ignoreCase = true) }
                LazyColumn(Modifier.fillMaxWidth().weight(1f, fill = false)) {
                    if (shown.isEmpty()) item { Text("Nenhuma opção encontrada.") }
                    items(shown) { option ->
                        ExpressiveTextButton(onClick = { choose(option.value); close() }, enabled = option.enabled,
                            modifier = Modifier.fillMaxWidth()) {
                            Text(option.label, fontWeight = if (option.value == selected) FontWeight.Bold else FontWeight.Normal)
                        }
                    }
                }
            }
        },
        confirmButton = { ExpressiveTextButton(onClick = close) { Text("Fechar") } },
        scrollBody = false
    )
}

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
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val compact = maxHeight < 280.dp
            val showTitle = maxHeight >= 156.dp
            val verticalPadding = if (compact) 6.dp else 16.dp
            Column {
                if (showTitle) {
                    Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = verticalPadding)) {
                        val style = if (compact) MaterialTheme.typography.titleMedium else MaterialTheme.typography.titleLarge
                        ProvideTextStyle(style.copy(fontWeight = FontWeight.ExtraBold), title)
                    }
                    HorizontalDivider(color = colors.outline)
                }
                // Lists and other scrollable bodies need the sheet's finite height.
                val scroll = if (scrollBody) Modifier.verticalScroll(rememberScrollState()) else Modifier
                Column(Modifier.fillMaxWidth().weight(1f, fill = false).then(scroll)
                    .padding(horizontal = 16.dp, vertical = verticalPadding)) {
                    ProvideTextStyle(MaterialTheme.typography.bodyMedium, text)
                }
                HorizontalDivider(color = colors.outline)
                FlowRow(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = if (compact) 4.dp else 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    dismissButton?.invoke()
                    confirmButton()
                }
            }
        }
    }
}

@Composable
internal fun ProtecSheet(
    onDismissRequest: () -> Unit,
    navigation: Boolean = false,
    registration: Boolean = false,
    visible: Boolean = true,
    onExit: () -> Unit = {},
    content: @Composable ColumnScope.() -> Unit
) {
    val host = LocalProtecSheets.current
    val dismiss by rememberUpdatedState(onDismissRequest)
    val sheetContent by rememberUpdatedState(content)
    val navSheet by rememberUpdatedState(navigation)
    val registrationSheet by rememberUpdatedState(registration)
    val shown by rememberUpdatedState(visible)
    val exit by rememberUpdatedState(onExit)
    val team by rememberUpdatedState(LocalTeamPanel.current)
    val entry = remember {
        ProtecSheetEntry { top ->
            CompositionLocalProvider(LocalTeamPanel provides team) {
                ProtecSheetLayer(top, navSheet, registrationSheet, shown, dismiss, exit, sheetContent)
            }
        }
    }
    DisposableEffect(host, entry) {
        host.add(entry)
        onDispose { host.remove(entry) }
    }
}

@Composable
internal fun ProtecSheetHost(sheets: List<ProtecSheetEntry>) {
    val top = sheets.lastOrNull()
    val focus = LocalFocusManager.current
    LaunchedEffect(top) { if (top != null) focus.clearFocus() }
    sheets.forEach { entry -> key(entry) { entry.render(entry === top) } }
}

@Composable
private fun ProtecSheetLayer(
    top: Boolean,
    navigation: Boolean,
    registration: Boolean,
    visible: Boolean,
    onDismissRequest: () -> Unit,
    onExit: () -> Unit,
    content: @Composable ColumnScope.() -> Unit
) {
    BackHandler(enabled = top, onBack = onDismissRequest)
    val coveredBlur by animateDpAsState(if (top) 0.dp else 14.dp, tween(200, easing = WebEase), label = "Desfoque da janela anterior")
    val colors = MaterialTheme.colorScheme
    val scrim = remember { Animatable(0f) }
    val panel = remember { Animatable(0f) }
    val exit by rememberUpdatedState(onExit)
    LaunchedEffect(visible, navigation) {
        val target = if (visible) 1f else 0f
        val easing = if (!navigation) WebEaseOut else if (visible) MoreEnterEase else MoreExitEase
        val duration = if (!navigation) 340 else if (visible) 460 else 300
        coroutineScope {
            launch { scrim.animateTo(target, tween(if (navigation) duration else 200, easing = if (navigation) easing else WebEase)) }
            panel.animateTo(target, tween(duration, easing = easing))
        }
        if (!visible) exit()
    }
    // All sheets use the Activity's measured viewport with system and keyboard insets applied.
    Box(Modifier.fillMaxSize().hideCoveredContent(!top)) {
        Box(Modifier.fillMaxSize()
            .graphicsLayer { alpha = scrim.value }
            .background(colors.scrim.copy(alpha = .4f))
            .clickable(remember { MutableInteractionSource() }, indication = null, onClick = onDismissRequest)
            .clearAndSetSemantics {})
        BoxWithConstraints(
            Modifier.fillMaxSize()
                .padding(when {
                    navigation -> PaddingValues(start = 12.dp, end = 12.dp, bottom = 9.dp)
                    registration -> PaddingValues()
                    else -> PaddingValues(bottom = 8.dp)
                })
                .clipToBounds(),
            contentAlignment = Alignment.BottomCenter
        ) {
            val maxSheetHeight = when {
                registration -> (maxHeight * .56f).coerceIn(minOf(400.dp, maxHeight), minOf(520.dp, maxHeight))
                maxHeight < 360.dp -> maxHeight
                navigation -> maxHeight * .82f
                else -> maxHeight * .92f
            }
            Surface(
                modifier = Modifier.widthIn(max = if (navigation) 590.dp else 650.dp).fillMaxWidth().heightIn(max = maxSheetHeight)
                    .graphicsLayer {
                        alpha = if (navigation) 1f else panel.value
                        val distance = if (navigation) size.height + 9.dp.toPx() else 32.dp.toPx()
                        translationY = distance * (1f - panel.value)
                    }
                    .blur(coveredBlur)
                    .semantics { isTraversalGroup = true }
                    .pointerInput(Unit) { detectTapGestures {} },
                shape = if (registration) RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp) else RoundedCornerShape(24.dp),
                color = colors.surface,
                border = BorderStroke(1.dp, colors.outline)
            ) {
                Column(content = content)
            }
        }
    }
}
