package br.com.protecextintores.nativo

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

private val pt = Locale.forLanguageTag("pt-BR")
private val monthFormat = DateTimeFormatter.ofPattern("MMMM 'de' uuuu", pt)
private val dayFormat = DateTimeFormatter.ofPattern("dd/MM/uuuu")
private fun String.asDay() = runCatching { LocalDate.parse(this) }.getOrNull()
private fun String.asMonth() = runCatching { YearMonth.parse(this) }.getOrNull()
private fun JSONObject.services() = optJSONArray("services").objects().map(::Svc)
private data class AgendaEntry(val date: LocalDate, val description: String, val order: Svc)

@Composable
internal fun AdminAgenda(state: JSONObject, open: (String) -> Unit) {
    val orders = state.services().filterNot { it.cancelled }
    var nextOnly by remember { mutableStateOf(false) }
    val now = LocalDate.now()
    val entries = orders.flatMap { order ->
        listOfNotNull(
            order.date.asDay()?.takeUnless { nextOnly }?.let { AgendaEntry(it, "Atendimento", order) },
            order.j.str("nextMaintenanceMonth").asMonth()?.atDay(1)?.let { AgendaEntry(it, "Próxima manutenção", order) }
        )
    }.filter { !it.date.isBefore(if (it.description == "Atendimento") now else now.withDayOfMonth(1)) }
        .sortedBy { it.date }.groupBy { YearMonth.from(it.date) }
    PanelList {
        item { PanelIntro("", "Agenda de manutenções") }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                WebFilterChip(!nextOnly, { nextOnly = false }, label = { Text("Agenda") })
                WebFilterChip(nextOnly, { nextOnly = true }, label = { Text("Próximas manutenções") })
            }
        }
        if (entries.isEmpty()) item { EmptyRecord("Nenhuma data futura cadastrada.") }
        for ((month, dates) in entries) {
            item { Text(month.format(monthFormat), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
            items(dates) { date ->
                val day = if (date.description == "Atendimento") " · ${date.date.format(dayFormat)}" else ""
                PanelShortcut("${date.order.code} · ${date.order.client}", date.description + day, PanelIcon.Clock) { open(date.order.id) }
            }
        }
    }
}

@Composable
internal fun AdminAlerts(state: JSONObject, open: (String) -> Unit, stock: () -> Unit) {
    val now = LocalDate.now()
    val month = YearMonth.from(now)
    val soon = YearMonth.from(now.plusDays(60))
    val orders = state.services().filterNot { it.cancelled }
    val expired = orders.filter { it.j.str("nextMaintenanceMonth").asMonth()?.isBefore(month) == true }
    val upcoming = orders.filter { it.j.str("nextMaintenanceMonth").asMonth()?.let { due -> due in month..soon } == true }
    val low = state.optJSONArray("inventory").objects().filter { it.optDouble("qty", 0.0) <= it.optDouble("minQty", 0.0) }
    val review = orders.filter { it.employeeCompleted && !it.closed }
    PanelList {
        item { PanelIntro("", "Alertas operacionais") }
        for ((label, group) in listOf("Aguardando revisão" to review, "Validades vencidas" to expired, "Próximas em até 60 dias" to upcoming)) {
            item { Text("$label (${group.size})", style = MaterialTheme.typography.titleLarge) }
            if (group.isEmpty()) item { EmptyRecord("Nenhuma ordem neste grupo.") }
            items(group) { order ->
                PanelShortcut(order.code, order.client, PanelIcon.List) { open(order.id) }
            }
        }
        item { Text("Estoque baixo (${low.size})", style = MaterialTheme.typography.titleLarge) }
        if (low.isEmpty()) item { EmptyRecord("Nenhum item no mínimo de estoque.") }
        items(low) { entry ->
            PanelShortcut(entry.str("name"), "${entry.str("qty")} ${entry.str("unit")} · mínimo ${entry.str("minQty")}", PanelIcon.Chart, stock)
        }
    }
}

@Composable
internal fun AdminReports(vm: AppVm, state: JSONObject) {
    val orders = state.services()
    val active = orders.filterNot { it.cancelled }
    val closed = active.filter { it.closed }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val latest by androidx.compose.runtime.rememberUpdatedState(orders)
    val export = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) scope.launch {
            val saved = withContext(Dispatchers.IO) {
                runCatching {
                    val stream = context.contentResolver.openOutputStream(uri) ?: return@runCatching false
                    stream.bufferedWriter(Charsets.UTF_8).use { it.write(serviceCsv(latest)) }
                    true
                }.getOrDefault(false)
            }
            vm.message = if (saved) "Relatório CSV salvo." else "Não foi possível salvar o relatório."
        }
    }
    PanelList {
        item { PanelIntro("", "Relatórios operacionais") }
        item { PrimaryButton("Exportar CSV") { export.launch("relatorio-protecextintores-${LocalDate.now()}.csv") } }
        item { PanelMetrics(listOf(
            PanelMetric("Registradas", active.size.toString()), PanelMetric("Finalizadas", closed.size.toString()),
            PanelMetric("Em andamento", active.count { !it.finished }.toString()),
            PanelMetric("Em revisão", active.count { it.employeeCompleted && !it.closed }.toString()),
            PanelMetric("Valor finalizado", formatRegistrationMoney(closed.sumOf { Math.round(it.j.optDouble("price", 0.0) * 100) }))
        )) }
        for ((title, field) in listOf("Por funcionário" to "employeeName", "Por vendedor" to "sellerName")) {
            item { Text(title, style = MaterialTheme.typography.titleLarge) }
            val groups = active.groupBy { it.j.str(field).ifBlank { "Sem responsável" } }.entries
                .sortedByDescending { it.value.size }
            items(groups) { (name, rows) -> CardBox {
                Text(name, fontWeight = FontWeight.Bold)
                Text("${rows.size} registradas · ${rows.count { it.closed }} finalizadas · ${rows.count { it.employeeCompleted && !it.closed }} em revisão")
            } }
        }
    }
}

@Composable
internal fun AdminTeamHistory(state: JSONObject, open: (String) -> Unit) {
    var sellers by remember { mutableStateOf(false) }
    var selection by remember(sellers) { mutableStateOf<String?>(null) }
    val idKey = if (sellers) "sellerId" else "employeeId"
    val nameKey = if (sellers) "sellerName" else "employeeName"
    val groups = state.services().filter { it.j.str(idKey).isNotBlank() }
        .groupBy { it.j.str(idKey) }.entries.sortedBy { it.value.first().j.str(nameKey) }
    PanelList {
        item { PanelIntro("", "Histórico da equipe") }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                WebFilterChip(!sellers, { sellers = false }, label = { Text("Funcionários") })
                WebFilterChip(sellers, { sellers = true }, label = { Text("Vendedores") })
            }
        }
        if (groups.isEmpty()) item { EmptyRecord("Ainda não há ordens vinculadas.") }
        for ((id, orders) in groups) {
            item {
                PanelShortcut(orders.first().j.str(nameKey).ifBlank { "Cadastro sem nome" },
                    "${orders.size} ordem(ns)", PanelIcon.People) { selection = if (selection == id) null else id }
            }
            if (selection == id) items(orders.sortedByDescending { it.date }) { order ->
                PanelShortcut(order.code, "${order.client} · ${order.displayStatus}", PanelIcon.List) { open(order.id) }
            }
        }
    }
}

private fun serviceCsv(orders: List<Svc>): String = buildString {
    append('\uFEFF')
    fun row(values: List<String>) {
        append(values.joinToString(";") { text ->
            val safe = if (text.trimStart().firstOrNull() in listOf('=', '+', '-', '@')) "'$text" else text
            "\"" + safe.replace("\"", "\"\"") + "\""
        })
        append("\r\n")
    }
    row(listOf("Código", "Cliente", "Serviço", "Data", "Próxima manutenção", "Funcionário", "Vendedor", "Status", "Valor"))
    for (order in orders) row(listOf(order.code, order.client, order.type, order.date, order.j.str("nextMaintenanceMonth"),
        order.employeeName, order.j.str("sellerName"), order.displayStatus,
        String.format(Locale.ROOT, "%.2f", order.j.optDouble("price", 0.0))))
}
