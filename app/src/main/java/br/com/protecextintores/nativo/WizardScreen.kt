package br.com.protecextintores.nativo

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale

@Composable
fun WizardScreen(vm: AppVm, id: String, onRecord: (String) -> Unit, onPick: (String) -> Unit) {
    val p = vm.profile
    val svc = p?.find(id)
    if (p == null || svc == null) {
        LaunchedEffect(Unit) { vm.back() }
        return
    }
    val st = vm.wizard
    val ctx = WizardCtx(svc, p, st)
    val steps = ctx.steps()
    val cur = st.step.coerceIn(0, steps.size - 1)
    val step = steps[cur]
    val last = cur == steps.size - 1
    val distance = with(LocalDensity.current) { 28.dp.roundToPx() }

    Column(modifier = Modifier.fillMaxSize()) {
        ScreenHeader("Concluir execução", onBack = { vm.back() })
        StepDots(steps, cur)
        Box(modifier = Modifier.weight(1f)) {
            AnimatedContent(
                targetState = step,
                transitionSpec = {
                    val direction = if (st.goingBack) -1 else 1
                    (slideInHorizontally(tween(300, easing = WebEaseOut)) { direction * distance } +
                        fadeIn(tween(300, easing = WebEaseOut))) togetherWith ExitTransition.None
                },
                label = "passo"
            ) { s ->
                Column(
                    modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 8.dp)
                ) {
                    when (s) {
                        WStep.PAINT -> PaintStep(ctx)
                        WStep.PARTS -> PartsStep(ctx)
                        WStep.POWDER -> PowderStep(ctx)
                        WStep.VIDEOS -> VideosStep(ctx, onRecord, onPick)
                        WStep.REVIEW -> ReviewStep(ctx)
                    }
                }
            }
        }
        if (st.error.isNotEmpty()) {
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.error),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
            ) {
                Text(st.error, modifier = Modifier.padding(12.dp), style = MaterialTheme.typography.bodyMedium)
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (cur > 0) {
                SoftButton("Voltar") {
                    st.goingBack = true
                    st.error = ""
                    st.step = cur - 1
                }
            }
            PrimaryButton(if (last) "Concluir execução" else "Avançar", Modifier.weight(1f)) {
                val error = ctx.validate(step)
                if (error.isNotEmpty()) {
                    st.error = error
                } else if (last) {
                    vm.submitWizard(svc)
                } else {
                    st.goingBack = false
                    st.error = ""
                    st.step = cur + 1
                }
            }
        }
    }
}

@Composable
private fun StepDots(steps: List<WStep>, current: Int) {
    Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp)) {
        steps.forEachIndexed { index, step ->
            val active = index <= current
            val color by animateColorAsState(
                if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                animationSpec = tween(300, easing = WebEase),
                label = "ponto"
            )
            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(modifier = Modifier.size(30.dp).background(color, CircleShape), contentAlignment = Alignment.Center) {
                    if (index < current) {
                        Icon(Icons.Filled.Check, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(18.dp))
                    } else {
                        Text(
                            (index + 1).toString(),
                            color = if (active) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    step.label,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = if (index == current) FontWeight.Bold else FontWeight.Normal,
                    color = if (active) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun StepTitle(title: String, hint: String) {
    Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(6.dp))
    Text(hint, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun YesNo(value: Boolean?, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        ChoiceButton("Não", value == false, Modifier.weight(1f)) { onChange(false) }
        ChoiceButton("Sim", value == true, Modifier.weight(1f)) { onChange(true) }
    }
}

@Composable
private fun ChoiceButton(text: String, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val background by animateColorAsState(
        if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface,
        animationSpec = tween(250),
        label = "fundo"
    )
    val foreground by animateColorAsState(
        if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
        animationSpec = tween(250),
        label = "texto"
    )
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = background,
        border = BorderStroke(1.5.dp, if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline),
        modifier = modifier.heightIn(min = 60.dp).clip(RoundedCornerShape(16.dp)).clickable(onClick = onClick)
    ) {
        Box(modifier = Modifier.fillMaxWidth().padding(vertical = 18.dp), contentAlignment = Alignment.Center) {
            Text(text, color = foreground, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        }
    }
}

@Composable
private fun QtyStepper(value: Int, min: Int, max: Int, suffix: String = "", onChange: (Int) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        FilledTonalIconButton(onClick = { if (value > min) onChange(value - 1) }, enabled = value > min) {
            Text("−", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        }
        Text(
            "$value$suffix",
            modifier = Modifier.widthIn(min = 64.dp),
            textAlign = TextAlign.Center,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp
        )
        FilledTonalIconButton(onClick = { if (value < max) onChange(value + 1) }, enabled = value < max) {
            Text("+", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun PaintStep(ctx: WizardCtx) {
    val st = ctx.st
    StepTitle("Usou pintura neste serviço?", "Esta ordem tem ${ctx.total} extintor(es). Não é preciso dizer quais foram pintados.")
    YesNo(st.paintUse) {
        st.paintUse = it
        st.error = ""
    }
    if (st.paintUse == true) {
        Spacer(Modifier.height(12.dp))
        Text("Quantos extintores foram pintados?", fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(8.dp))
        QtyStepper(st.paintQty, 1, maxOf(1, ctx.total)) { st.paintQty = it }
    }
}

private fun hasStock(ctx: WizardCtx, part: String): Boolean {
    val stock = ctx.stockOf(part)
    return stock == null || stock >= 1
}

@Composable
private fun PartsStep(ctx: WizardCtx) {
    val st = ctx.st
    StepTitle(
        "Trocou alguma peça?",
        "Cada peça aparece uma vez. A quantidade vai até o número de extintores da ordem (${ctx.total}) e até o que há em estoque."
    )
    YesNo(st.partsUse) { use ->
        st.partsUse = use
        st.error = ""
        if (use && st.rows.isEmpty()) {
            val first = ctx.profile.partCatalog().firstOrNull { hasStock(ctx, it) }
            if (first != null) st.rows.add(PartRow(first, 1))
        }
    }
    if (st.partsUse == true) {
        st.rows.forEachIndexed { index, row -> PartRowUi(ctx, index, row) }
        val next = ctx.unusedParts(-1).firstOrNull { hasStock(ctx, it) }
        SoftButton("＋ Adicionar outra peça", Modifier.fillMaxWidth(), enabled = next != null) {
            if (next != null) st.rows.add(PartRow(next, 1))
        }
    }
}

@Composable
private fun PartRowUi(ctx: WizardCtx, index: Int, row: PartRow) {
    val st = ctx.st
    var open by remember { mutableStateOf(false) }
    val max = maxOf(1, ctx.maxFor(row.part))
    CardBox(Modifier.padding(bottom = 10.dp)) {
        Box {
            val stockLabel = ctx.stockOf(row.part)?.let { " · estoque $it" } ?: ""
            SoftButton(row.part + stockLabel, Modifier.fillMaxWidth()) { open = true }
            DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                ctx.unusedParts(index).forEach { part ->
                    val stock = ctx.stockOf(part)
                    val out = stock != null && stock < 1 && part != row.part
                    DropdownMenuItem(
                        text = {
                            Text(part + (if (stock != null) " · estoque $stock" else "") + (if (out) " (sem estoque)" else ""))
                        },
                        enabled = !out,
                        onClick = {
                            open = false
                            val limit = maxOf(1, ctx.maxFor(part))
                            st.rows[index] = PartRow(part, minOf(row.qty, limit))
                        }
                    )
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            QtyStepper(row.qty, 1, max) { st.rows[index] = row.copy(qty = it) }
            TextButton(onClick = { st.rows.removeAt(index) }) { Text("Remover") }
        }
    }
}

private fun formatKg(value: Double): String =
    if (value == Math.floor(value)) value.toInt().toString() else String.format(Locale("pt", "BR"), "%.1f", value)

@Composable
private fun PowderStep(ctx: WizardCtx) {
    val st = ctx.st
    StepTitle(
        "Usou pó químico?",
        "Informe o total em kg, sem separar por extintor. O limite é o estoque e a capacidade dos extintores da ordem."
    )
    YesNo(st.powderUse) {
        st.powderUse = it
        st.error = ""
    }
    if (st.powderUse == true) {
        for (agent in ctx.agents) {
            Spacer(Modifier.height(12.dp))
            Text(
                if (ctx.agents.size > 1) "Pó ${agent.agent}: quantos kg?" else "Quantos kg de pó?",
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.height(8.dp))
            QtyStepper(st.kg[agent.agent] ?: 0, 0, agent.maxKg, " kg") { st.kg[agent.agent] = it }
            val stockText = agent.balanceKg?.let { " · estoque ${formatKg(it + agent.beforeKg)} kg" } ?: " · estoque conferido ao enviar"
            Text(
                "Máximo: ${agent.maxKg} kg$stockText",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun VideosStep(ctx: WizardCtx, onRecord: (String) -> Unit, onPick: (String) -> Unit) {
    val st = ctx.st
    StepTitle("Vídeos das peças trocadas", "Cada peça trocada precisa do seu vídeo, com até 60 segundos e 50 MB.")
    Spacer(Modifier.height(14.dp))
    for (need in ctx.needVideos()) {
        val info = st.videos[need.id]
        CardBox(Modifier.padding(bottom = 10.dp)) {
            Text("${need.part} · equipamento ${need.index + 1}", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))
            Text(
                when {
                    info != null -> "Vídeo guardado · ${info.seconds.toInt()} s"
                    need.done -> "Vídeo já registrado"
                    else -> "Grave ou escolha o vídeo"
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SoftButton("Gravar", Modifier.weight(1f)) { onRecord(need.id) }
                SoftButton("Galeria", Modifier.weight(1f)) { onPick(need.id) }
            }
        }
    }
}

@Composable
private fun ReviewLine(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
        Text(value, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1.4f), textAlign = TextAlign.End)
    }
}

@Composable
private fun ReviewStep(ctx: WizardCtx) {
    val st = ctx.st
    StepTitle("Conferir e concluir", "Ao concluir, a ordem segue para revisão administrativa.")
    Spacer(Modifier.height(14.dp))
    CardBox {
        ReviewLine("Pintura", if (st.paintUse == true) "${st.paintQty} extintor(es)" else "Não usou")
        val rows = ctx.cleanRows()
        ReviewLine("Peças", if (rows.isEmpty()) "Não trocou" else rows.joinToString("\n") { "${it.part} × ${it.qty}" })
        if (ctx.agents.isNotEmpty()) {
            val used = ctx.agents.filter { (st.kg[it.agent] ?: 0) > 0 }
            val text = if (st.powderUse == true && used.isNotEmpty()) {
                used.joinToString(" · ") { (if (ctx.agents.size > 1) "Pó ${it.agent}: " else "") + "${st.kg[it.agent] ?: 0} kg" }
            } else {
                "Não usou"
            }
            ReviewLine("Pó", text)
        }
    }
}
