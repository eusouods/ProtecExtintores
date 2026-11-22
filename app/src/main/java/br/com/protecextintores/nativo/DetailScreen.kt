package br.com.protecextintores.nativo

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun DetailScreen(vm: AppVm, id: String) {
    val p = vm.profile
    val svc = p?.find(id)
    if (p == null || svc == null) {
        LaunchedEffect(Unit) { vm.back() }
        return
    }
    var stageDialog by remember { mutableStateOf(false) }
    var pauseDialog by remember { mutableStateOf(false) }
    val flow = p.flow
    val mineService = svc.employeeId == p.actorId

    Column(modifier = Modifier.fillMaxSize()) {
        ScreenHeader(svc.code.ifEmpty { "Ordem de serviço" }, onBack = { vm.back() })
        Column(
            modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            CardBox {
                Text(svc.client.ifEmpty { "Cliente" }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(4.dp))
                Text(
                    listOf(svc.type, svc.date).filter { it.isNotEmpty() }.joinToString(" · "),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(10.dp))
                StatusChip(svc.displayStatus)
                if (svc.paused && svc.pauseReason.isNotEmpty()) {
                    Spacer(Modifier.height(10.dp))
                    Text("Motivo da pausa: ${svc.pauseReason}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            CardBox {
                Text("Andamento", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(10.dp))
                PhaseTimeline(svc.phase)
            }
            CardBox {
                Text("Equipamentos", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                svc.items.forEachIndexed { index, item ->
                    val kg = item.str("kg")
                    val parts = item.optJSONArray("replacedParts").strings()
                    Column(modifier = Modifier.padding(vertical = 6.dp)) {
                        Text("Unidade ${index + 1} · ${item.str("type")}" + if (kg.isNotEmpty()) " · $kg kg" else "", fontWeight = FontWeight.SemiBold)
                        if (parts.isNotEmpty()) {
                            Text("Peças: " + parts.joinToString(", "), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        EvidenceLinks(item)
                    }
                }
            }
            ServiceSelections(svc.j)
            StaffTransfer(vm, p, svc) { vm.refresh(silent = true) }
            CardBox {
                Text("Resumo", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                InfoLine("Responsável técnico", svc.employeeName.ifEmpty { "Aguardando aceite" })
                InfoLine("Pinturas", if (svc.paintingRecorded) svc.paintingQty.toString() else "—")
                val usage = svc.powderUsage
                if (usage.isNotEmpty()) {
                    InfoLine("Pó químico", usage.joinToString(" · ") { it.str("agent") + ": " + (it.optInt("grams", 0) / 1000) + " kg" })
                }
                if (!svc.j.isNull("retailAmount") && svc.j.has("retailAmount")) {
                    InfoLine("Valor ao cliente", NumberFormat.getCurrencyInstance(Locale("pt", "BR")).format(svc.j.optDouble("retailAmount", 0.0)))
                }
            }
            val events = svc.j.optJSONArray("events").objects().reversed().take(6)
            if (events.isNotEmpty()) {
                CardBox {
                    Text("Últimos registros", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp))
                    for (event in events) {
                        Column(modifier = Modifier.padding(vertical = 5.dp)) {
                            Text(event.str("status"), fontWeight = FontWeight.SemiBold)
                            val detail = event.str("item")
                            Text(
                                formatWhen(event.str("at")) + if (detail.isNotEmpty()) " · $detail" else "",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
        }
        ActionBar(vm, svc, mineService, onStage = { stageDialog = true }, onPause = { pauseDialog = true })
    }

    if (stageDialog) {
        val order = flow.stages
        val current = order.indexOf(svc.status)
        val next = maxOf(0, minOf(current + 1, order.size - 1))
        val options = order.filterIndexed { i, _ -> flow.allowSkip || i <= current + 1 }
        var chosen by remember { mutableStateOf(order.getOrElse(next) { "" }) }
        ProtecDialog(
            onDismissRequest = { stageDialog = false },
            title = { Text("Atualizar etapa") },
            text = {
                Column {
                    Text("Etapa atual: " + svc.status.ifEmpty { "—" }, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(8.dp))
                    options.forEach { stage ->
                        Row(
                            modifier = Modifier.fillMaxWidth().clickable { chosen = stage }.padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(selected = chosen == stage, onClick = { chosen = stage })
                            Text(stage)
                        }
                    }
                }
            },
            confirmButton = {
                ExpressiveTextButton(onClick = {
                    stageDialog = false
                    if (chosen.isNotEmpty()) vm.updateStage(svc, chosen)
                }) { Text("Atualizar") }
            },
            dismissButton = { ExpressiveTextButton(onClick = { stageDialog = false }) { Text("Cancelar") } }
        )
    }

    if (pauseDialog) {
        var reason by remember { mutableStateOf("") }
        ProtecDialog(
            onDismissRequest = { pauseDialog = false },
            title = { Text("Pausar serviço") },
            text = {
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text("Motivo da pausa") },
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                ExpressiveTextButton(onClick = {
                    if (reason.trim().length < 3) {
                        vm.message = "Informe o motivo da pausa."
                    } else {
                        pauseDialog = false
                        vm.pause(svc, reason)
                    }
                }) { Text("Pausar") }
            },
            dismissButton = { ExpressiveTextButton(onClick = { pauseDialog = false }) { Text("Cancelar") } }
        )
    }
}

@Composable
private fun ActionBar(vm: AppVm, svc: Svc, mineService: Boolean, onStage: () -> Unit, onPause: () -> Unit) {
    val p = vm.profile ?: return
    val flow = p.flow
    Surface(
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            when {
                svc.cancelled -> Text("Esta ordem foi cancelada.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                svc.employeeId.isEmpty() -> PrimaryButton("Aceitar serviço") { vm.claim(svc) }
                !mineService -> Text("Esta ordem está com outro funcionário.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                svc.finished -> Text("Execução enviada. Agora é com a administração.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                svc.paused -> PrimaryButton("Retomar serviço") { vm.resume(svc) }
                else -> {
                    val order = flow.stages
                    val completeIndex = order.indexOf(flow.completeAt)
                    val atEnd = completeIndex >= 0 && order.indexOf(svc.status) >= completeIndex
                    if (flow.requireCompleteStage) {
                        if (atEnd) PrimaryButton("Concluir execução") { vm.startWizard(svc) } else PrimaryButton("Atualizar etapa") { onStage() }
                    } else {
                        PrimaryButton("Atualizar etapa") { onStage() }
                        SoftButton("Concluir execução", Modifier.fillMaxWidth()) { vm.startWizard(svc) }
                    }
                    SoftButton("Pausar serviço", Modifier.fillMaxWidth()) { onPause() }
                }
            }
        }
    }
}

@Composable
private fun InfoLine(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
        Text(value, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun PhaseTimeline(phase: Int) {
    val labels = listOf("Registrado", "Aguardando aceite", "Em execução", "Revisão administrativa", "Finalizado")
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        labels.forEachIndexed { index, label ->
            PhaseRow(index + 1, label, done = index < phase, current = index == phase)
        }
    }
}

@Composable
private fun PhaseRow(number: Int, label: String, done: Boolean, current: Boolean) {
    val primary = MaterialTheme.colorScheme.primary
    val idle = MaterialTheme.colorScheme.surfaceVariant
    val color by animateColorAsState(if (done || current) primary else idle, animationSpec = tween(400), label = "fase")
    val transition = rememberInfiniteTransition(label = "pulso")
    val pulse by transition.animateFloat(
        initialValue = 1f,
        targetValue = 1.14f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "escala"
    )
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier.size(30.dp).scale(if (current) pulse else 1f).background(color, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            if (done) {
                Icon(Icons.Filled.Check, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(18.dp))
            } else {
                Text(
                    number.toString(),
                    color = if (current) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )
            }
        }
        Spacer(Modifier.size(12.dp))
        Text(
            label,
            fontWeight = if (current) FontWeight.Bold else FontWeight.Normal,
            color = if (done || current) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

private fun formatWhen(iso: String): String {
    if (iso.isEmpty()) return ""
    return try {
        Instant.parse(iso).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("dd/MM HH:mm"))
    } catch (e: Exception) {
        iso.take(10)
    }
}
