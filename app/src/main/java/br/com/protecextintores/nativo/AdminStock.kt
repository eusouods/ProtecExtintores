package br.com.protecextintores.nativo

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.text.Normalizer
import java.text.NumberFormat
import java.time.Instant
import java.util.Locale
import java.util.UUID

internal enum class StockGroup(val key: String, val label: String) {
    Parts("parts", "Peças"), Extinguishers("extinguishers", "Extintores"), Powder("powder", "Pó")
}

internal data class StockStart(val group: StockGroup, val id: String = "")
private data class StockReview(val original: JSONObject?, val title: String, val unit: String, val current: Double,
                               val quantity: Double, val cost: Double?, val minimum: Double?)
private data class StockRequest(val payload: JSONObject, val itemId: String)
private const val NewStockItem = "__new__"
private val stockFields = listOf(
    CatalogField("name", "Nome do item"), CatalogField("category", "Categoria"), CatalogField("unit", "Unidade"),
    CatalogField("qty", "Quantidade em estoque", true), CatalogField("minQty", "Estoque mínimo", true),
    CatalogField("unitCost", "Custo unitário (R$)", true)
)

private fun normalizedStockName(value: String) = Normalizer.normalize(value, Normalizer.Form.NFD)
    .replace(Regex("\\p{M}"), "").trim().lowercase(Locale.ROOT)

private fun stockGroup(row: JSONObject) = when {
    row.str("powderAgent").isNotBlank() -> StockGroup.Powder
    normalizedStockName(row.str("category")).startsWith("extintor") -> StockGroup.Extinguishers
    else -> StockGroup.Parts
}

private fun stockRows(state: JSONObject): List<JSONObject> {
    val rows = state.optJSONArray("inventory").objects().filter { it.str("id").isNotBlank() }
    return rows + listOf("ABC", "BC").filter { agent -> rows.none { it.str("powderAgent") == agent } }.map { agent ->
        JSONObject().put("id", "powder-$agent").put("name", "Pó químico $agent").put("qty", 0)
            .put("unit", "kg").put("powderAgent", agent)
    }
}

private fun numberText(value: Double) = NumberFormat.getNumberInstance(Locale.forLanguageTag("pt-BR"))
    .apply { maximumFractionDigits = 3 }.format(value)

private fun stockNumber(input: String, digits: Int, max: Double, min: Double = 0.0): Double? {
    val value = input.trim()
    val pattern = if (digits == 0) "\\d+" else "\\d+(?:[,.]\\d{1,$digits})?"
    if (!Regex(pattern).matches(value)) return null
    return value.replace(',', '.').toDoubleOrNull()?.takeIf { it in min..max }
}

@Composable
internal fun AdminStock(vm: AppVm, state: JSONObject, openPowderHistory: () -> Unit) {
    var group by remember { mutableStateOf<StockGroup?>(null) }
    var itemId by remember { mutableStateOf("") }
    var wizard by remember { mutableStateOf<StockStart?>(null) }
    var editing by remember { mutableStateOf<JSONObject?>(null) }
    val colors = MaterialTheme.colorScheme
    val rows = stockRows(state).filter { group == null || stockGroup(it) == group }
    val selected = rows.find { it.str("id") == itemId } ?: rows.firstOrNull()
    PanelList(spacing = 8.dp) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Peças, extintores e pó para recarga.", color = colors.onSurfaceVariant)
                PrimaryButton("＋ Adicionar ao estoque", enabled = !vm.busy) { wizard = StockStart(group ?: StockGroup.Parts) }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    (listOf(null) + StockGroup.entries).forEach { filter ->
                        WebFilterChip(group == filter, { group = filter }, label = { Text(filter?.label ?: "Todos") })
                    }
                }
            }
        }
        if (selected != null) item {
            val powder = stockGroup(selected) == StockGroup.Powder
            Surface(shape = MaterialTheme.shapes.medium, color = colors.surfaceVariant) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(selected.str("category").ifBlank { stockGroup(selected).label }, color = colors.onSurfaceVariant)
                    Text(selected.str("name"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("${numberText(selected.optDouble("qty", 0.0))} ${selected.str("unit").ifBlank { "un." }}",
                        style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    if (selected.has("minQty")) Text("Estoque mínimo · ${numberText(selected.optDouble("minQty", 0.0))}")
                    if (!selected.isNull("unitCost")) {
                        val cost = formatRegistrationMoney(Math.round(selected.optDouble("unitCost", 0.0) * 100))
                        Text(if (powder) "$cost por kg · Custo médio" else "$cost · Custo unitário")
                    }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        ExpressiveButton(enabled = !vm.busy, onClick = { wizard = StockStart(stockGroup(selected), selected.str("id")) }) { Text("Registrar entrada") }
                        if (powder) ExpressiveTextButton(onClick = openPowderHistory) { Text("Movimentações") }
                        else ExpressiveTextButton(enabled = !vm.busy, onClick = { editing = selected }) { Text("Editar item") }
                    }
                }
            }
        }
        if (rows.isEmpty()) item { EmptyRecord("Nenhum item nesta categoria.") }
        items(rows, key = { it.str("id") }) { row ->
            Surface(onClick = { itemId = row.str("id") }, color = if (row === selected) colors.primaryContainer else colors.surface,
                shape = MaterialTheme.shapes.small) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 13.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text(row.str("name"), fontWeight = FontWeight.SemiBold)
                        val low = row.has("minQty") && row.optDouble("qty") <= row.optDouble("minQty")
                        Text(if (low) "${stockGroup(row).label} · Estoque baixo" else stockGroup(row).label, color = colors.onSurfaceVariant)
                    }
                    Text("${numberText(row.optDouble("qty", 0.0))} ${row.str("unit").ifBlank { "un." }}")
                }
            }
        }
    }
    wizard?.let { start -> StockEntryDialog(vm, state, start, onSaved = { id -> itemId = id; group = null }) { wizard = null } }
    editing?.let { original ->
        NativeFieldsDialog("Editar item", stockFields, original, vm.busy, { editing = null }) { values ->
            vm.saveAdminRecord("inventory", original, values) { editing = null }
            null
        }
    }
}

@Composable
internal fun StockEntryDialog(vm: AppVm, state: JSONObject, start: StockStart, onSaved: (String) -> Unit = {}, close: () -> Unit) {
    var group by remember { mutableStateOf(start.group) }
    val options = stockRows(state).filter { stockGroup(it) == group }
    var itemId by remember { mutableStateOf(start.id.ifBlank { options.firstOrNull()?.str("id") ?: NewStockItem }) }
    var step by remember { mutableIntStateOf(0) }
    var name by remember { mutableStateOf("") }
    var quantity by remember { mutableStateOf("") }
    var cost by remember { mutableStateOf("") }
    var minimum by remember { mutableStateOf("0") }
    var reference by remember { mutableStateOf("") }
    var issue by remember { mutableStateOf<String?>(null) }
    var reviewed by remember { mutableStateOf<StockReview?>(null) }
    var request by remember { mutableStateOf<StockRequest?>(null) }
    val row = options.find { it.str("id") == itemId }
    val powder = group == StockGroup.Powder
    val creating = itemId == NewStockItem
    val colors = MaterialTheme.colorScheme

    fun review(): String? {
        val incoming = stockNumber(quantity, if (powder) 3 else 0, if (powder) 100_000.0 else 1_000_000.0, if (powder) .001 else 1.0)
            ?: return if (powder) "Informe de 0,001 a 100.000 kg, com até três casas decimais." else "Informe de 1 a 1.000.000 de unidades inteiras."
        val value = if (powder || creating) stockNumber(cost, 2, 1_000_000.0) ?: return "Informe um custo válido. Use zero quando não houver custo." else null
        val min = if (creating) stockNumber(minimum, 0, 1_000_000.0) ?: return "Informe um estoque mínimo inteiro e não negativo." else null
        if (powder && reference.trim().length < 3) return "Informe pelo menos três caracteres na referência."
        if (!creating && row == null) return "Selecione um item disponível."
        val balance = row?.optDouble("qty") ?: 0.0
        if (!balance.isFinite() || balance < 0) return "Confira o saldo do item antes de registrar a entrada."
        reviewed = StockReview(row, row?.str("name") ?: name.trim(), row?.str("unit").orEmpty().ifBlank { "un." }, balance, incoming, value, min)
        return null
    }

    fun submit() {
        val snapshot = reviewed ?: return
        val pending = request ?: run {
            if (snapshot.original?.toString() != row?.toString()) {
                step = 2
                issue = "O saldo mudou. Revise a entrada."
                return
            }
            if (creating && options.any { normalizedStockName(it.str("name")) == normalizedStockName(name) }) {
                step = 1
                issue = "Este item já está cadastrado. Selecione-o na lista."
                return
            }
            val entryId = UUID.randomUUID().toString()
            val at = Instant.now().toString()
            if (powder) {
                val payload = JSONObject().put("action", "powder-entry").put("entryId", entryId)
                    .put("agent", row?.str("powderAgent")).put("kg", snapshot.quantity).put("unitCost", snapshot.cost)
                    .put("reference", reference.trim())
                val original = state.optJSONArray("inventory").objects().find { it.str("id") == itemId }
                StockRequest(vm.makePowderEntryOperation(state, original, payload, entryId, at), itemId)
            } else {
                val updated = if (snapshot.original != null) JSONObject(snapshot.original.toString()) else {
                    val digest = MessageDigest.getInstance("SHA-256").digest("${group.key}:${normalizedStockName(name)}".toByteArray(Charsets.UTF_8))
                        .joinToString("") { "%02x".format(it.toInt() and 0xff) }
                    JSONObject().put("id", "stock-custom-$digest").put("name", name.trim()).put("category", group.label)
                        .put("unit", "un").put("minQty", snapshot.minimum).put("unitCost", snapshot.cost)
                }
                val entries = updated.optJSONArray("stockEntries") ?: JSONArray()
                entries.put(JSONObject().put("id", entryId).put("at", at).put("quantity", snapshot.quantity))
                updated.put("qty", snapshot.current + snapshot.quantity).put("stockEntries", entries)
                StockRequest(vm.makeStockOperation(state, snapshot.original, updated, entryId, at), updated.str("id"))
            }
        }
        request = pending
        issue = null
        vm.submitStockOperation(pending.payload, done = { onSaved(pending.itemId); close() }) { code, message ->
            if (code == 409 || code == 400) { request = null; step = 2 }
            issue = message
        }
    }

    ProtecDialog(onDismissRequest = { if (!vm.busy) close() }, title = { Text("Adicionar ao estoque") }, text = {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                listOf("Categoria", "Item", "Quantidade", "Revisão").forEachIndexed { index, label ->
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Box(Modifier.fillMaxWidth().height(3.dp).background(if (index == step) colors.primary else colors.outline))
                        Text(label, color = if (index == step) colors.primary else colors.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
            when (step) {
                0 -> StockPicker("Categoria", group.key, StockGroup.entries.map { it.key to it.label }, !vm.busy) { value ->
                    val next = StockGroup.entries.first { it.key == value }
                    if (next != group) {
                        group = next
                        itemId = stockRows(state).firstOrNull { stockGroup(it) == next }?.str("id") ?: NewStockItem
                        name = ""; quantity = ""; cost = ""; minimum = "0"; reference = ""
                    }
                    issue = null
                }
                1 -> {
                    val choices = options.map { it.str("id") to it.str("name") } + if (powder) emptyList() else listOf(NewStockItem to "Cadastrar novo item")
                    StockPicker("Item", itemId, choices, !vm.busy) { itemId = it; issue = null }
                    if (creating) StockField("Nome do novo item", name, { name = it.take(80); issue = null })
                }
                2 -> {
                    StockField(if (powder) "Quantidade (kg)" else "Quantidade (unidades)", quantity, { quantity = it.take(14); issue = null }, if (powder) KeyboardType.Decimal else KeyboardType.Number)
                    if (powder || creating) StockField(if (powder) "Custo por kg (R$)" else "Custo unitário (R$)", cost, { cost = it.take(14); issue = null }, KeyboardType.Decimal)
                    if (powder) StockField("Nota, fornecedor ou referência", reference, { reference = it.take(300); issue = null })
                    if (creating) StockField("Estoque mínimo (unidades)", minimum, { minimum = it.take(14); issue = null }, KeyboardType.Number)
                }
                3 -> reviewed?.let { value ->
                    Text(value.title, fontWeight = FontWeight.Bold)
                    Surface(shape = MaterialTheme.shapes.small, color = colors.surfaceVariant) {
                        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            ReviewLine("Saldo atual", "${numberText(value.current)} ${value.unit}")
                            ReviewLine("Entrada", "+${numberText(value.quantity)} ${value.unit}")
                            ReviewLine("Saldo previsto", "${numberText(value.current + value.quantity)} ${value.unit}", bold = true)
                        }
                    }
                }
            }
            issue?.let { Text(it, color = colors.error) }
        }
    }, confirmButton = {
        ExpressiveButton(enabled = !vm.busy, onClick = {
            if (step == 3) submit() else {
                issue = when {
                    step == 1 && creating && name.trim().isEmpty() -> "Informe o nome do novo item."
                    step == 1 && creating && options.any { normalizedStockName(it.str("name")) == normalizedStockName(name) } -> "Este item já está cadastrado nesta categoria."
                    step == 1 && !creating && row == null -> "Selecione um item disponível."
                    step == 2 -> review()
                    else -> null
                }
                if (issue == null) step++
            }
        }) { Text(if (vm.busy) "Registrando…" else if (request != null) "Tentar novamente" else if (step == 3) "Confirmar entrada" else "Avançar") }
    }, dismissButton = {
        ExpressiveTextButton(enabled = !vm.busy && request == null, onClick = {
            if (step == 0) close() else { step--; issue = null }
        }) { Text(if (step == 0) "Cancelar" else "Voltar") }
    })
}

@Composable
private fun StockField(label: String, value: String, change: (String) -> Unit, keyboard: KeyboardType = KeyboardType.Text) {
    OutlinedTextField(value, change, modifier = Modifier.fillMaxWidth(), label = { Text(label) },
        singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = keyboard))
}

@Composable
private fun StockPicker(label: String, value: String, choices: List<Pair<String, String>>, enabled: Boolean, change: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        Text(label, style = MaterialTheme.typography.labelLarge)
        ExpressiveOutlinedButton(enabled = enabled, onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
            Text(choices.firstOrNull { it.first == value }?.second ?: "Selecione")
        }
    }
    if (expanded) ProtecOptions(label, choices.map { (id, title) -> SheetOption(id, title) }, value, close = { expanded = false }, choose = change)
}

@Composable
private fun ReviewLine(label: String, value: String, bold: Boolean = false) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label)
        Text(value, fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal)
    }
}
