package br.com.protecextintores.nativo

import androidx.activity.compose.BackHandler
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asComposePath
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.graphics.PathParser
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.roundToLong

internal enum class PanelIcon(val data: String) {
    Plus("M12 5v14M5 12h14"),
    Grid("M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"),
    Wrench("M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z"),
    Flame("M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"),
    People("M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0m-9 12a6 6 0 0 1 12 0m1-15a3 3 0 0 1 0 6m5 9a6 6 0 0 0-4-5"),
    Clock("M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"),
    Chart("M5 19V11m6 8V5m6 14V8M3 20h18"),
    Dots("M5 12h.1M12 12h.1M19 12h.1"),
    Search("M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0M20 20l-3.5-3.5"),
    Refresh("M20 11a8 8 0 1 0-2 6m2-12v6h-6"),
    Theme("M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0M12 7v10m-2-9v8M8.5 9v6"),
    Bell("M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"),
    Wallet("M20 8H5a2 2 0 0 1 0-4h13m2 4v12H5a2 2 0 0 1-2-2V6m17 6h-5a2 2 0 0 0 0 4h5"),
    Close("M6 6l12 12M18 6 6 18"),
    Chevron("m9 6 6 6-6 6"),
    ChevronDown("m6 9 6 6 6-6"),
    Money("M12 2v20m5-15h-7a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H7"),
    Box("M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5m-9 5v8"),
    Cart("M6 7h14l-1.5 9H8zM6 7 5 3H2M10 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0m8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0"),
    Shield("M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"),
    Exit("M9 4H5v16h4m7-12 4 4-4 4m4-4H9"),
    List("M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h5");
}

internal data class PanelTab(val label: String, val icon: PanelIcon, val title: String = label)
internal data class PanelAction(val label: String, val icon: PanelIcon, val run: () -> Unit)

@Composable
internal fun PanelGlyph(icon: PanelIcon, color: Color = MaterialTheme.colorScheme.onSurfaceVariant, iconSize: Dp = 22.dp) {
    val path = remember(icon) { PathParser.createPathFromPathData(icon.data)?.asComposePath() }
    Canvas(Modifier.size(iconSize)) {
        if (path != null) {
            scale(size.width / 24f, size.height / 24f, pivot = Offset.Zero) {
                drawPath(path, color, style = Stroke(1.9f, cap = StrokeCap.Round, join = StrokeJoin.Round))
            }
        }
    }
}

@Composable
internal fun PanelChrome(
    tabs: List<PanelTab>,
    selected: Int,
    select: (Int) -> Unit,
    actions: List<PanelAction>,
    refresh: () -> Unit,
    changeTheme: () -> Unit,
    team: Boolean = false,
    title: String? = null,
    dockSection: Int = selected,
    selectDock: (Int) -> Unit = select,
    openAlerts: (() -> Unit)? = null,
    subTabs: List<Pair<Int, String>> = emptyList(),
    content: @Composable (Int) -> Unit
) {
    var more by remember { mutableStateOf(false) }
    val pages = rememberSaveableStateHolder()
    val closeMore = { more = false }
    BackHandler(selected != 0 || more) { if (more) closeMore() else select(0) }
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.fillMaxWidth().weight(1f)) {
            Column(Modifier.fillMaxSize()) {
                PanelHeader(title ?: tabs.getOrNull(selected)?.title.orEmpty(), refresh, changeTheme, openAlerts)
                if (subTabs.size > 1) WebSectionTabs(subTabs, selected, select,
                    Modifier.padding(start = 12.dp, end = 12.dp, top = 14.dp))
                pages.SaveableStateProvider(selected) {
                    CompositionLocalProvider(LocalTeamPanel provides team) {
                        if (team) WebRise(230, 9.dp, startAlpha = .55f, easing = WebTeamEase) { content(selected) }
                        else content(selected)
                    }
                }
            }
        }
        PanelDock(tabs, dockSection, team, selectDock) { more = true }
    }
    if (more) {
        CompositionLocalProvider(LocalTeamPanel provides team) {
            ProtecSheet(onDismissRequest = closeMore, navigation = true) {
                PanelMore(actions, closeMore, team)
            }
        }
    }
}

@Composable
private fun PanelHeader(title: String, refresh: () -> Unit, changeTheme: () -> Unit, alerts: (() -> Unit)?) {
    val brand = MaterialTheme.colorScheme.protecBrand
    val ink = MaterialTheme.colorScheme.protecOnBrand
    Surface(color = brand, contentColor = ink) {
      Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 15.dp)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 44.dp),
            horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically
        ) {
            Image(painterResource(R.drawable.company_logo), null, Modifier.size(27.dp).clip(RoundedCornerShape(6.dp)))
            Text("ProtecExtintores", Modifier.weight(1f), fontSize = 13.sp, lineHeight = 17.sp, fontWeight = FontWeight.Bold,
                maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (alerts != null) {
                HeaderPanelAction("Atualizar painel", null, ink, refresh)
                HeaderPanelAction("Alertas", PanelIcon.Bell, ink, alerts)
            } else HeaderPanelAction("Atualizar painel", PanelIcon.Refresh, ink, refresh)
            HeaderPanelAction("Alternar tema", PanelIcon.Theme, ink, changeTheme)
        }
        Text(title, fontSize = 27.sp, lineHeight = 33.sp, fontWeight = FontWeight(680), letterSpacing = (-.8).sp,
            modifier = Modifier.padding(top = 9.dp))
      }
    }
}

@Composable
private fun HeaderPanelAction(label: String, icon: PanelIcon?, ink: Color, action: () -> Unit) {
    ExpressiveIconButton(onClick = action, modifier = Modifier.semantics { contentDescription = label }, contentColor = ink,
        outline = Color(0xFFA2C6ED).copy(alpha = .38f), round = icon == null) {
        if (icon == null) Box(Modifier.size(6.dp).background(ink, CircleShape))
        else PanelGlyph(icon, ink, 19.dp)
    }
}

@Composable
private fun PanelMore(actions: List<PanelAction>, close: () -> Unit, team: Boolean) {
    val colors = MaterialTheme.colorScheme
    val closeSource = remember { MutableInteractionSource() }
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState())
        .padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 15.dp)) {
        Row(Modifier.fillMaxWidth().padding(bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Mais", Modifier.weight(1f), fontSize = if (team) 23.sp else 21.sp, fontWeight = FontWeight.Bold,
                letterSpacing = (-.7).sp)
            Box(
                Modifier.size(44.dp).pressLikeWeb(closeSource).webActionFocus(closeSource)
                    .clickable(closeSource, indication = null, role = Role.Button, onClick = close)
                    .semantics { contentDescription = "Fechar menu" },
                contentAlignment = Alignment.Center
            ) {
                PanelGlyph(PanelIcon.Close, color = colors.onSurface, iconSize = 21.dp)
            }
        }
        for (action in actions) {
            val source = remember { MutableInteractionSource() }
            HorizontalDivider(color = colors.outline)
            Row(
                Modifier.fillMaxWidth().heightIn(min = if (team) 57.dp else 64.dp)
                    .pressLikeWeb(source).webActionFocus(source)
                    .clickable(interactionSource = source, indication = null, role = Role.Button) {
                        close()
                        action.run()
                    }
                    .padding(vertical = if (team) 7.dp else 10.dp),
                horizontalArrangement = Arrangement.spacedBy(if (team) 13.dp else 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                val iconBackground = if (team) colors.surfaceVariant else colors.primaryContainer
                Box(Modifier.size(if (team) 38.dp else 42.dp).background(iconBackground, RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center) { PanelGlyph(action.icon, colors.onSurface, 20.dp) }
                Text(action.label, Modifier.weight(1f), fontSize = if (team) 14.sp else 16.sp,
                    fontWeight = if (team) FontWeight.Bold else FontWeight.SemiBold)
                if (!team && action.icon != PanelIcon.Exit) PanelGlyph(PanelIcon.Chevron, iconSize = 16.dp)
            }
        }
    }
}

@Composable
private fun PanelDock(tabs: List<PanelTab>, selected: Int, team: Boolean, select: (Int) -> Unit, showMore: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val destinations = tabs + PanelTab("Mais", PanelIcon.Dots)
    val tabGap = 2.dp
    val trackPadding = 4.dp
    Surface(modifier = Modifier.widthIn(max = 614.dp).fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 5.dp, bottom = 9.dp),
        shape = RoundedCornerShape(15.dp), color = colors.surface, shadowElevation = 4.dp,
        border = BorderStroke(1.dp, colors.outline)) {
        BoxWithConstraints(Modifier.fillMaxWidth().padding(trackPadding).clipToBounds()) {
            val slot = (maxWidth - tabGap * (destinations.size - 1)).coerceAtLeast(0.dp) / destinations.size
            // Abrir o menu Mais mantém o destaque na tela atual.
            val index = if (selected in tabs.indices) selected else tabs.size
            val offset by animateDpAsState((slot + tabGap) * index,
                tween(420, easing = if (team) WebTeamPillEase else WebEaseSpring), label = "Destaque da aba")
            Canvas(Modifier.matchParentSize()) {
                val width = slot.toPx()
                val x = if (layoutDirection == LayoutDirection.Rtl) size.width - width - offset.toPx() else offset.toPx()
                drawRoundRect(colors.primaryContainer, Offset(x, 0f), Size(width, size.height), CornerRadius(10.dp.toPx()))
            }
            Row(Modifier.fillMaxWidth().selectableGroup(), horizontalArrangement = Arrangement.spacedBy(tabGap)) {
                destinations.forEachIndexed { item, tab ->
                    val active = item == index
                    val source = remember { MutableInteractionSource() }
                    val labelColor = if (active) colors.primary else colors.onSurfaceVariant
                    val iconColor by animateColorAsState(labelColor,
                        tween(250, easing = WebEase), label = "Cor do ícone")
                    Column(
                        Modifier.weight(1f).heightIn(min = 48.dp)
                            .pressLikeWeb(source, pressedScale = if (team) .94f else .96f)
                            .webActionFocus(source)
                            .selectable(
                                selected = active, role = Role.Tab, interactionSource = source, indication = null,
                                onClick = { if (item == tabs.size) showMore() else select(item) }
                            )
                            .padding(vertical = 5.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(3.dp, Alignment.CenterVertically)
                    ) {
                        PanelGlyph(tab.icon, iconColor, 19.dp)
                        Text(tab.label, fontSize = 11.sp, lineHeight = 12.sp, letterSpacing = (-.11).sp,
                            fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                            color = labelColor)
                    }
                }
            }
        }
    }
}

@Composable
internal fun PanelSearch(query: String, change: (String) -> Unit, hint: String) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(14.dp)
    val interactions = remember { MutableInteractionSource() }
    val focused by interactions.collectIsFocusedAsState()
    val style = MaterialTheme.typography.bodyLarge
    BasicTextField(
        query, change, Modifier.fillMaxWidth().semantics { contentDescription = hint }, singleLine = true,
        textStyle = style.copy(color = colors.onSurface), interactionSource = interactions,
        cursorBrush = SolidColor(colors.primary), keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search)
    ) { field ->
        Row(Modifier.fillMaxWidth().heightIn(min = 50.dp).background(colors.surface, shape)
            .border(1.dp, if (focused) colors.primary else colors.outlineVariant, shape)
            .padding(horizontal = 14.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            PanelGlyph(PanelIcon.Search, iconSize = 20.dp)
            Box(Modifier.weight(1f)) {
                if (query.isEmpty()) Text(hint, style = style, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    color = colors.onSurfaceVariant)
                field()
            }
        }
    }
}

@Composable
internal fun WebSectionTabs(options: List<Pair<Int, String>>, selected: Int, choose: (Int) -> Unit, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).selectableGroup(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for ((id, label) in options) {
            WebFilterChip(id == selected, { choose(id) }, label = { Text(label) })
        }
    }
}

@Composable
internal fun WebFilterChip(selected: Boolean, onClick: () -> Unit, enabled: Boolean = true, label: @Composable () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val source = remember { MutableInteractionSource() }
    val shape = RoundedCornerShape(10.dp)
    val background by animateColorAsState(if (selected) colors.secondaryContainer else colors.surface,
        tween(170, easing = WebEase), label = "Fundo da seção")
    Box(
        Modifier.heightIn(min = 48.dp).pressLikeWeb(source).clip(shape).background(background)
            .border(1.dp, if (selected) Color.Transparent else colors.outline, shape)
            .webActionFocus(source)
            .selectable(selected, source, null, enabled, Role.Tab, onClick)
            .padding(horizontal = 12.dp, vertical = 7.dp),
        contentAlignment = Alignment.Center
    ) {
        ProvideTextStyle(MaterialTheme.typography.labelMedium.copy(fontSize = 12.sp, lineHeight = 17.sp,
            color = if (selected && enabled) colors.onSurface else colors.onSurfaceVariant,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold), label)
    }
}

@Composable
internal fun PanelIntro(label: String, title: String, description: String = "", modifier: Modifier = Modifier) {
    val team = LocalTeamPanel.current
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (label.isNotBlank()) Text(label, fontSize = 11.sp, lineHeight = 16.sp,
            fontWeight = FontWeight.ExtraBold, letterSpacing = 1.32.sp)
        Text(title, fontSize = if (team) 26.sp else 29.sp, lineHeight = if (team) 32.sp else 35.sp,
            fontWeight = if (team) FontWeight(650) else FontWeight.Bold, letterSpacing = (-1.02).sp)
        if (description.isNotBlank()) Text(description, fontSize = if (team) 13.sp else 14.sp, lineHeight = 22.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

internal data class PanelMetric(val label: String, val value: String, val detail: String = "")

@Composable
internal fun PanelMetrics(metrics: List<PanelMetric>, animateValues: Boolean = false) {
    val colors = MaterialTheme.colorScheme
    Surface(shape = RoundedCornerShape(14.dp), color = colors.surface, border = BorderStroke(1.dp, colors.outline)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            for ((row, pair) in metrics.chunked(2).withIndex()) {
                Row(Modifier.fillMaxWidth()) {
                    for ((column, metric) in pair.withIndex()) {
                        val index = row * 2 + column
                        Box(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                            WebRise(550, 16.dp, minOf(index, 3) * 70, play = animateValues) {
                                Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                                    Text(metric.label, fontSize = 12.sp, lineHeight = 17.sp, fontWeight = FontWeight.Bold)
                                    MetricValue(metric.value, animateValues)
                                    if (metric.detail.isNotEmpty()) Text(metric.detail, fontSize = 11.sp, lineHeight = 16.sp,
                                        color = colors.onSurfaceVariant)
                                }
                            }
                        }
                    }
                    if (pair.size == 1) Box(Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun MetricValue(text: String, animate: Boolean) {
    val money = text.startsWith("R\$")
    val target = remember(text) {
        if (money) text.substringAfter("R\$").trim().replace(".", "").replace(",", ".").toDoubleOrNull()
        else text.toLongOrNull()?.toDouble()
    }
    val number = if (animate && target != null && target > 0) {
        val format = remember { NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")) }
        val progress = remember { Animatable(0f) }
        LaunchedEffect(target) {
            progress.snapTo(0f)
            progress.animateTo(1f, tween(800, easing = WebCountEase))
        }
        if (progress.value >= 1f) text else if (money) format.format(target * progress.value)
        else (target * progress.value).roundToLong().toString()
    } else text
    Text(number, fontSize = 23.sp, lineHeight = 29.sp, fontWeight = FontWeight.Bold, letterSpacing = (-.57).sp,
        style = MaterialTheme.typography.titleLarge.copy(fontFeatureSettings = "tnum"))
}

@Composable
internal fun PanelShortcut(title: String, subtitle: String, icon: PanelIcon, click: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val source = remember { MutableInteractionSource() }
    Surface(
        onClick = click, shape = RoundedCornerShape(14.dp), color = colors.surfaceVariant,
        border = BorderStroke(1.dp, colors.outline), interactionSource = source,
        modifier = Modifier.fillMaxWidth().heightIn(min = 65.dp).pressLikeWeb(source)
    ) {
        Row(Modifier.padding(13.dp), horizontalArrangement = Arrangement.spacedBy(9.dp),
            verticalAlignment = Alignment.CenterVertically) {
            PanelGlyph(icon, colors.onSurface, 23.dp)
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp, lineHeight = 18.sp)
                Text(subtitle, fontSize = 11.sp, lineHeight = 16.sp, color = colors.onSurfaceVariant)
            }
        }
    }
}

@Composable
internal fun panelActions(vm: AppVm, refresh: () -> Unit) = listOf(
    PanelAction("Atualizar serviços", PanelIcon.Refresh, refresh),
    PanelAction("Alternar tema", PanelIcon.Theme) { vm.cycleTheme() },
    PanelAction("Sair da conta", PanelIcon.Exit) { vm.logout() }
)

internal val teamTabs = listOf(
    PanelTab("Painel", PanelIcon.Grid, "Visão geral"),
    PanelTab("Serviços", PanelIcon.Wrench),
    PanelTab("Agenda", PanelIcon.Clock, "Próximas manutenções"),
    PanelTab("Acertos", PanelIcon.Chart)
)
