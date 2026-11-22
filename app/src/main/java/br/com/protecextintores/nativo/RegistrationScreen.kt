package br.com.protecextintores.nativo

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

private val steps = listOf("Cliente", "Equipamentos", "Complementos", "Conferir")
private data class Choice(val value: String, val label: String = value)
private data class RowToEdit(val group: String, val index: Int, val value: JSONObject)

@Composable
internal fun RegistrationScreen(vm: AppVm) {
    val catalog = vm.registrationCatalog
    val draft = vm.registrationDraft
    val step = draft.optInt("step").coerceIn(0, 3)
    val pending = draft.has("pendingOperation")
    var edit by remember { mutableStateOf<RowToEdit?>(null) }
    if (catalog == null) {
        Column(Modifier.fillMaxSize()) {
            ScreenHeader("Registrar manutenção / serviço") { vm.back() }
            PanelList {
                item {
                    Text(vm.registrationError.ifEmpty { "Carregando opções do sistema…" })
                    if (!vm.busy) PrimaryButton("Carregar catálogo") { vm.loadRegistration() }
                }
            }
        }
        return
    }
    Column(Modifier.fillMaxSize()) {
        ScreenHeader("Registrar manutenção / serviço") { vm.back() }
        if (pending) {
            PanelList {
                item {
                    PanelIntro("", "Verificar envio", "A ordem está guardada neste aparelho. Verifique o envio antes de registrar outra.")
                }
                if (vm.registrationError.isNotEmpty()) item { EmptyRecord(vm.registrationError) }
                item { PrimaryButton("Verificar envio", enabled = !vm.busy) { vm.submitRegistration() } }
            }
            return
        }
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text("Etapa ${step + 1} de ${steps.size} · ${steps[step]}", style = MaterialTheme.typography.labelLarge)
            LinearProgressIndicator(progress = { (step + 1) / steps.size.toFloat() }, modifier = Modifier.fillMaxWidth())
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                steps.forEachIndexed { index, name ->
                    FilterChip(step == index, { vm.registrationStep(index) }, label = { Text(name) },
                        enabled = !vm.busy)
                }
            }
        }
        AnimatedContent(
            targetState = step,
            modifier = Modifier.fillMaxWidth().weight(1f),
            transitionSpec = {
                val direction = if (targetState > initialState) 1 else -1
                (slideInHorizontally { direction * it / 6 } + fadeIn()) togetherWith
                    (slideOutHorizontally { -direction * it / 6 } + fadeOut())
            },
            label = "Etapas do registro"
        ) { page ->
            PanelList {
                when (page) {
                    0 -> item { RegistrationContact(vm, catalog, draft) }
                    1, 2 -> {
                        val groups = if (page == 1) registrationGroups.take(2) else registrationGroups.drop(2)
                        for (group in groups) {
                            if (group == "hydrantHoses" && catalog.complements.none { it.str("id") == "hydrant-hose-test" } &&
                                draft.optJSONArray(group).objects().isEmpty()) continue
                            item {
                                RegistrationRows(group, draft.optJSONArray(group).objects(), catalog,
                                    open = { index, value -> edit = RowToEdit(group, index, value) },
                                    remove = { index ->
                                        vm.editRegistration {
                                            put(group, JSONArray(optJSONArray(group).objects().filterIndexed { i, _ -> i != index }))
                                        }
                                    })
                            }
                        }
                    }
                    else -> item { RegistrationReview(vm, catalog, draft) }
                }
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outline)
        Column(Modifier.fillMaxWidth().padding(13.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (vm.registrationError.isNotEmpty()) {
                Text(vm.registrationError, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            } else if (vm.registrationSaved) {
                Text("Rascunho salvo neste aparelho", style = MaterialTheme.typography.bodySmall)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (step > 0) OutlinedButton(onClick = { vm.registrationStep(step - 1) }) { Text("Voltar") }
                PrimaryButton(if (step == 3) "Registrar ordem" else "Avançar", modifier = Modifier.weight(1f), enabled = !vm.busy) {
                    if (step == 3) vm.submitRegistration() else vm.registrationStep(step + 1)
                }
            }
        }
    }
    edit?.let { row ->
        RegistrationRowEditor(catalog, row, dismiss = { edit = null }) { value ->
            vm.editRegistration {
                val rows = optJSONArray(row.group).objects().toMutableList()
                if (row.index == rows.size) rows.add(value) else rows[row.index] = value
                put(row.group, JSONArray(rows))
            }
            edit = null
        }
    }
}

@Composable
private fun RegistrationContact(vm: AppVm, catalog: RegistrationCatalog, draft: JSONObject) {
    val own = catalog.actorName.takeIf { it.isNotEmpty() }?.let { "Serviço próprio · $it" } ?: "Serviço próprio"
    val clients = directoryChoices(catalog, "clients")
    val choices = listOf(Choice("__self__", own), Choice("__new__", "Informar novo cliente")) + clients
    Column(verticalArrangement = Arrangement.spacedBy(13.dp)) {
        PanelIntro("", "Cliente")
        Pick("Cliente", draft.str("clientChoice"), choices) { choice ->
            vm.editRegistration { put("clientChoice", choice) }
        }
        if (draft.str("clientChoice") == "__new__") {
            DraftField(vm, draft, "clientName", "Nome do cliente", limit = 100)
            DraftField(vm, draft, "clientPhone", "Telefone (opcional)", KeyboardType.Phone, 30)
            DraftField(vm, draft, "clientEmail", "E-mail (opcional)", KeyboardType.Email, 254)
        }
        if (vm.portalRole == "admin") {
            Pick("Vendedor responsável", draft.str("sellerChoice"), listOf(Choice("", "Sem vendedor")) + directoryChoices(catalog, "sellers")) {
                vm.editRegistration { put("sellerChoice", it) }
            }
        }
    }
}

@Composable
private fun RegistrationReview(vm: AppVm, catalog: RegistrationCatalog, draft: JSONObject) {
    val lines = catalog.quote(draft)
    val total = lines.sumOf { (it.cents ?: 0L) * it.count }
    val clientName = when (val choice = draft.str("clientChoice")) {
        "__new__" -> draft.str("clientName")
        "", "__self__" -> "Serviço próprio · ${catalog.actorName}"
        else -> directoryChoices(catalog, "clients").firstOrNull { it.value == choice }?.label ?: "Cliente"
    }
    Column(verticalArrangement = Arrangement.spacedBy(13.dp)) {
        PanelIntro("", "Confira a ordem", clientName)
        if (lines.isNotEmpty()) CardBox {
            Text("Itens da ordem", fontWeight = FontWeight.ExtraBold)
            for (line in lines) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outline)
                Text("${line.count} × ${line.label}", fontWeight = FontWeight.SemiBold)
                Text(line.cents?.let { formatRegistrationMoney(it * line.count) } ?: "Preço a definir",
                    style = MaterialTheme.typography.bodySmall)
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outline)
            Text(if (lines.any { it.cents == null }) "Sugestão pendente de preço" else "Valor sugerido · ${formatRegistrationMoney(total)}",
                fontWeight = FontWeight.Bold)
        }
        DraftField(vm, draft, "date", "Data do serviço (AAAA-MM-DD)", limit = 10)
        DraftField(vm, draft, "nextMaintenanceMonth", "Próxima manutenção (AAAA-MM)", limit = 7)
        DraftField(vm, draft, "serviceAmount", "Valor combinado (R$)", KeyboardType.Decimal, 12)
        DraftField(vm, draft, "notes", "Observações (opcional)", limit = 3000, singleLine = false)
    }
}

@Composable
private fun DraftField(vm: AppVm, draft: JSONObject, field: String, label: String,
                       keyboard: KeyboardType = KeyboardType.Text, limit: Int, singleLine: Boolean = true) {
    OutlinedTextField(draft.str(field), { input ->
        if (input.length <= limit) vm.editRegistration { put(field, input) }
    }, modifier = Modifier.fillMaxWidth(), singleLine = singleLine, minLines = if (singleLine) 1 else 3,
        label = { Text(label) }, keyboardOptions = KeyboardOptions(keyboardType = keyboard))
}

@Composable
private fun RegistrationRows(group: String, rows: List<JSONObject>, catalog: RegistrationCatalog,
                             open: (Int, JSONObject) -> Unit, remove: (Int) -> Unit) {
    CardBox {
        Text(registrationLabel(group), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold)
        if (rows.isNotEmpty()) {
            val quantity = rows.sumOf { it.optInt("quantity", it.optInt("qty", 1)) }
            Text(if (quantity == 1) "1 unidade" else "$quantity unidades", style = MaterialTheme.typography.bodySmall)
        }
        rows.forEachIndexed { index, row ->
            val single = JSONObject().put(group, JSONArray(listOf(row)))
            val line = catalog.quote(single).firstOrNull()
            HorizontalDivider(color = MaterialTheme.colorScheme.outline)
            Text("${line?.count ?: 1} × ${line?.label.orEmpty()}", style = MaterialTheme.typography.bodyMedium)
            Row {
                TextButton(onClick = { open(index, row) }) { Text("Editar") }
                TextButton(onClick = { remove(index) }) { Text("Remover") }
            }
        }
        OutlinedButton(enabled = rows.size < 50, onClick = {
            val choice = JSONObject().put(if (group == "items") "qty" else "quantity", "1")
            if (group == "soldExtinguishers") choice.put("condition", "new")
            if (group == "hydrantHoses") choice.put("type", "Tipo 1").put("diameterMm", "38").put("lengthMeters", "15")
            open(rows.size, choice)
        }) { Text("Adicionar") }
    }
}

@Composable
private fun RegistrationRowEditor(catalog: RegistrationCatalog, edit: RowToEdit, dismiss: () -> Unit, apply: (JSONObject) -> Unit) {
    var row by remember { mutableStateOf(JSONObject(edit.value.toString())) }
    var invalid by remember { mutableStateOf(false) }
    val group = edit.group
    val countKey = if (group == "items") "qty" else "quantity"
    val put: (String, String) -> Unit = { key, value ->
        invalid = false
        row = JSONObject(row.toString()).put(key, value)
    }
    AlertDialog(
        onDismissRequest = dismiss,
        title = { Text(registrationLabel(group)) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                when (group) {
                    "items", "soldExtinguishers" -> {
                        if (group == "soldExtinguishers") {
                            Pick("Condição", row.str("condition"), catalog.conditions.map {
                                Choice(it.str("value"), it.str("label") + if (it.optBoolean("hasRing")) " · com argola" else " · sem argola")
                            }) { put("condition", it) }
                        }
                        val valid = catalog.equipment.filter { group != "items" || it.optBoolean("maintenanceAllowed", true) }
                        val type = row.str("type")
                        Pick("Tipo de extintor", type, valid.map { Choice(it.str("type")) }.distinct()) { chosen ->
                            row = JSONObject(row.toString()).put("type", chosen).removeField("kg")
                            val capacities = valid.filter { it.str("type") == chosen }
                            if (capacities.size == 1) put("kg", capacities.single().str("kg"))
                            invalid = false
                        }
                        val capacity = valid.filter { it.str("type") == type }
                        if (capacity.size == 1 && capacity.first().optBoolean("fixedCapacity")) {
                            Text("Capacidade fixa: ${capacity.first().str("label")}")
                        } else if (capacity.isNotEmpty()) {
                            Pick("Peso / capacidade", row.opt("kg")?.toString(), capacity.map { Choice(it.str("kg"), it.str("label")) }) {
                                put("kg", it)
                            }
                        }
                    }
                    "plannedParts" -> Pick("Peça prevista", row.str("name"), catalog.parts.map { Choice(it.str("name")) }) { put("name", it) }
                    "hydrantHoses" -> {
                        Pick("Tipo", row.str("type"), catalog.options("hoseTypes").map { Choice(it) }) { put("type", it) }
                        Pick("Diâmetro", row.str("diameterMm"), catalog.options("diameters").map { Choice(it, "$it mm") }) { put("diameterMm", it) }
                        Pick("Comprimento", row.str("lengthMeters"), catalog.options("lengths").map { Choice(it, "$it m") }) { put("lengthMeters", it) }
                    }
                    else -> {
                        val options = catalog.complements.filter { it.str("placement") != "equipment" && it.str("id") != "hydrant-hose-test" }
                        val complement = options.firstOrNull { it.str("id") == row.str("catalogId") }
                        Pick("Serviço", row.str("catalogId"), options.map { Choice(it.str("id"), it.str("name")) }) { choice ->
                            row = JSONObject(row.toString()).put("catalogId", choice)
                                .removeField("variant").put("parameters", JSONObject())
                            invalid = false
                        }
                        if (complement != null) {
                            Pick("Tipo", row.str("variant"), complement.optJSONArray("variants").stringList().map { Choice(it) }) { put("variant", it) }
                            for (field in complement.optJSONArray("fields").objects()) {
                                val key = field.str("key")
                                Pick(field.str("label"), row.optJSONObject("parameters")?.str(key),
                                    field.optJSONArray("values").stringList().map { Choice(it) }) { value ->
                                    val next = JSONObject(row.toString())
                                    val params = next.optJSONObject("parameters") ?: JSONObject()
                                    next.put("parameters", params.put(key, value))
                                    row = next
                                    invalid = false
                                }
                            }
                        }
                    }
                }
                val max = if (group == "complementaryServices") 100 else 50
                Pick("Quantidade", row.str(countKey), (1..max).map { Choice(it.toString()) }) { put(countKey, it) }
                if (invalid) Text("Confira os campos e a quantidade.", color = MaterialTheme.colorScheme.error)
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val data = JSONObject().put(group, JSONArray(listOf(row)))
                if (catalog.validate(data, if (group in registrationGroups.take(2)) 1 else 2) == null) apply(row)
                else invalid = true
            }) { Text("Salvar item") }
        },
        dismissButton = { TextButton(onClick = dismiss) { Text("Cancelar") } }
    )
}

private fun JSONObject.removeField(field: String): JSONObject = apply { remove(field) }

@Composable
private fun Pick(label: String, selected: String?, options: List<Choice>, choose: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val value = options.firstOrNull { it.value == selected }?.label ?: "Selecionar"
    Column {
        Text(label, style = MaterialTheme.typography.labelMedium)
        OutlinedButton(onClick = { open = true }, enabled = options.isNotEmpty(), modifier = Modifier.fillMaxWidth()) {
            Text(value)
        }
    }
    if (open) {
        var search by rememberSaveable { mutableStateOf("") }
        val filtered = options.filter { it.label.contains(search.trim(), ignoreCase = true) }
        AlertDialog(
            onDismissRequest = { open = false },
            title = { Text(label) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    if (options.size > 12) PanelSearch(search, { search = it }, "Buscar")
                    LazyColumn(Modifier.heightIn(max = 310.dp)) {
                        items(filtered) { option ->
                            TextButton(onClick = { choose(option.value); open = false }, modifier = Modifier.fillMaxWidth()) {
                                Text(option.label, fontWeight = if (option.value == selected) FontWeight.Bold else FontWeight.Normal)
                            }
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { open = false }) { Text("Fechar") } }
        )
    }
}

private fun directoryChoices(catalog: RegistrationCatalog, type: String) =
    catalog.contacts.optJSONArray(type).objects().map { Choice(it.str("id"), it.str("name")) }

internal fun formatRegistrationMoney(cents: Long): String =
    NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")).format(cents / 100.0)
