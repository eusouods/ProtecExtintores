package br.com.protecextintores.nativo

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asComposePath
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.graphics.PathParser

internal enum class PanelIcon(val data: String) {
    Plus("M12 5v14M5 12h14"),
    Grid("M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"),
    Wrench("M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z"),
    Flame("M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"),
    People("M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0m-9 12a6 6 0 0 1 12 0m1-15a3 3 0 0 1 0 6m5 9a6 6 0 0 0-4-5"),
    Clock("M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"),
    Chart("M5 19V11m6 8V5m6 14V8M3 20h18"),
    Dots("M5 12h.1M12 12h.1M19 12h.1"),
    Search("M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 5 5"),
    Refresh("M20 11a8 8 0 1 0-2 6m2-12v6h-6"),
    Theme("M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"),
    Exit("M9 4H5v16h4m7-12 4 4-4 4m4-4H9"),
    List("M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h5");
}

internal data class PanelTab(val label: String, val icon: PanelIcon, val title: String = label)
internal data class PanelAction(val label: String, val icon: PanelIcon, val run: () -> Unit)

@Composable
internal fun PanelGlyph(icon: PanelIcon, color: Color = MaterialTheme.colorScheme.onSurfaceVariant) {
    val path = remember(icon) { PathParser.createPathFromPathData(icon.data)?.asComposePath() }
    Canvas(Modifier.size(21.dp)) {
        if (path != null) {
            scale(size.width / 24f, size.height / 24f, pivot = Offset.Zero) {
                drawPath(path, color, style = Stroke(1.8f, cap = StrokeCap.Round, join = StrokeJoin.Round))
            }
        }
    }
}

@Composable
internal fun PanelChrome(
    tabs: List<PanelTab>,
    selected: Int,
    select: (Int) -> Unit,
    initials: String,
    actions: List<PanelAction>,
    title: String? = null,
    content: @Composable (Int) -> Unit
) {
    var more by remember { mutableStateOf(false) }
    val colors = MaterialTheme.colorScheme
    BackHandler(selected != 0 && !more) { select(0) }
    Column(Modifier.fillMaxSize().blur(if (more) 11.dp else 0.dp)) {
        Surface(color = colors.surface.copy(alpha = .96f)) {
            Row(
                Modifier.fillMaxWidth().heightIn(min = 66.dp).padding(horizontal = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Image(
                    painterResource(R.drawable.company_logo),
                    contentDescription = null,
                    modifier = Modifier.size(31.dp).clip(RoundedCornerShape(5.dp))
                )
                Text(title ?: tabs.getOrNull(selected)?.title ?: "Mais", Modifier.weight(1f),
                    style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold)
                Surface(shape = CircleShape, color = colors.primaryContainer) {
                    Box(Modifier.size(38.dp), contentAlignment = Alignment.Center) {
                        Text(initials, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }
        HorizontalDivider(color = colors.outline)
        AnimatedContent(
            targetState = selected,
            modifier = Modifier.fillMaxWidth().weight(1f),
            transitionSpec = {
                val direction = if (targetState > initialState) 1 else -1
                (slideInHorizontally(tween(245)) { direction * it / 13 } + fadeIn(tween(230))) togetherWith
                    (slideOutHorizontally(tween(165)) { -direction * it / 18 } + fadeOut(tween(140)))
            },
            label = "Abas do painel"
        ) { page -> content(page) }
        HorizontalDivider(color = colors.outline)
        PanelDock(tabs, selected, more, select) { more = true }
    }
    if (more) {
        ModalBottomSheet(
            onDismissRequest = { more = false },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = colors.surface,
            scrimColor = colors.scrim.copy(alpha = .34f)
        ) {
            Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, bottom = 20.dp)) {
                Text("Mais", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(bottom = 12.dp))
                for (action in actions) {
                    HorizontalDivider(color = colors.outline)
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 56.dp).clickable {
                            more = false
                            action.run()
                        }.padding(vertical = 7.dp),
                        horizontalArrangement = Arrangement.spacedBy(13.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(Modifier.size(38.dp).clip(RoundedCornerShape(12.dp)).background(colors.surfaceVariant),
                            contentAlignment = Alignment.Center) { PanelGlyph(action.icon) }
                        Text(action.label, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

@Composable
private fun PanelDock(tabs: List<PanelTab>, selected: Int, more: Boolean, select: (Int) -> Unit, showMore: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val destinations = tabs + PanelTab("Mais", PanelIcon.Dots)
    Surface(color = colors.surface.copy(alpha = .94f)) {
        BoxWithConstraints(Modifier.fillMaxWidth().padding(horizontal = 5.dp, vertical = 6.dp)) {
            val width = maxWidth / destinations.size
            val pill = minOf(52.dp, width - 8.dp)
            val index = if (more || selected !in tabs.indices) tabs.size else selected
            val x by animateDpAsState(width * index + (width - pill) / 2, spring(dampingRatio = .86f, stiffness = 410f), label = "Pílula")
            Box(Modifier.offset(x = x, y = 5.dp).width(pill).height(30.dp).background(colors.primary, CircleShape))
            Row(Modifier.fillMaxWidth().selectableGroup()) {
                destinations.forEachIndexed { item, tab ->
                    val active = item == index
                    Column(
                        Modifier.weight(1f).heightIn(min = 59.dp).selectable(
                            selected = active, role = Role.Tab,
                            onClick = { if (item == tabs.size) showMore() else select(item) }
                        ).padding(top = 5.dp, bottom = 4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Box(Modifier.height(30.dp), contentAlignment = Alignment.Center) {
                            PanelGlyph(tab.icon, if (active) colors.onPrimary else colors.onSurfaceVariant)
                        }
                        Text(tab.label, fontSize = 10.sp, lineHeight = 12.sp,
                            fontWeight = if (active) FontWeight.ExtraBold else FontWeight.SemiBold,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                            color = if (active) colors.onSurface else colors.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
internal fun PanelSearch(query: String, change: (String) -> Unit, hint: String) {
    OutlinedTextField(
        query, change, Modifier.fillMaxWidth(), singleLine = true,
        shape = RoundedCornerShape(15.dp), leadingIcon = { PanelGlyph(PanelIcon.Search) },
        placeholder = { Text(hint, style = MaterialTheme.typography.bodyMedium) }
    )
}

@Composable
internal fun PanelIntro(label: String, title: String, description: String = "") {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        if (label.isNotBlank()) Text(label, style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
        Text(title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold,
            letterSpacing = (-.6).sp)
        if (description.isNotBlank()) Text(description, style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

internal data class PanelMetric(val label: String, val value: String, val detail: String = "")

@Composable
internal fun PanelMetrics(metrics: List<PanelMetric>) {
    val colors = MaterialTheme.colorScheme
    Surface(shape = RoundedCornerShape(16.dp), color = colors.surface, border = BorderStroke(1.dp, colors.outline)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
            for (pair in metrics.chunked(2)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    for (metric in pair) Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(metric.label, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                        Text(metric.value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
                        if (metric.detail.isNotEmpty()) Text(metric.detail, style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
internal fun PanelShortcut(title: String, subtitle: String, icon: PanelIcon, click: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Surface(
        onClick = click, shape = RoundedCornerShape(16.dp), color = colors.surfaceVariant,
        border = BorderStroke(1.dp, colors.outline), modifier = Modifier.fillMaxWidth()
    ) {
        Row(Modifier.padding(15.dp), horizontalArrangement = Arrangement.spacedBy(13.dp),
            verticalAlignment = Alignment.CenterVertically) {
            PanelGlyph(icon, colors.onSurface)
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleSmall)
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
            }
        }
    }
}

@Composable
internal fun panelActions(vm: AppVm, refresh: () -> Unit) = listOf(
    PanelAction("Atualizar painel", PanelIcon.Refresh, refresh),
    PanelAction("Alternar tema", PanelIcon.Theme) { vm.cycleTheme() },
    PanelAction("Sair da conta", PanelIcon.Exit) { vm.logout() }
)

internal val teamTabs = listOf(
    PanelTab("Painel", PanelIcon.Grid, "Visão geral"),
    PanelTab("Serviços", PanelIcon.Wrench),
    PanelTab("Agenda", PanelIcon.Clock, "Próximas manutenções"),
    PanelTab("Acertos", PanelIcon.Chart)
)
