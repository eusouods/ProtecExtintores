package br.com.protecextintores.nativo

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import org.json.JSONObject

internal data class CatalogField(val key: String, val label: String, val numeric: Boolean = false,
                                 val optional: Boolean = false, val default: String = "")

internal enum class CatalogArea(val group: String, val title: String, val fields: List<CatalogField>) {
    Stock("inventory", "Estoque", listOf(
        CatalogField("name", "Nome do item"), CatalogField("category", "Categoria", default = "Peças"),
        CatalogField("unit", "Unidade", default = "un"), CatalogField("qty", "Quantidade em estoque", true, default = "0"),
        CatalogField("minQty", "Estoque mínimo", true, default = "0"), CatalogField("unitCost", "Custo unitário (R$)", true, default = "0")
    )),
    Types("types", "Extintores", listOf(
        CatalogField("name", "Tipo de extintor"), CatalogField("kg", "Capacidade", optional = true),
        CatalogField("unit", "Unidade", default = "kg"), CatalogField("price", "Preço da manutenção (R$)", true, default = "0")
    )),
    Products("products", "Produtos da loja", listOf(
        CatalogField("name", "Nome do produto"), CatalogField("category", "Categoria", default = "Extintores"),
        CatalogField("type", "Tipo", optional = true), CatalogField("kg", "Peso ou capacidade", optional = true),
        CatalogField("model", "Modelo", optional = true), CatalogField("description", "Descrição", optional = true),
        CatalogField("price", "Preço (R$)", true, default = "0")
    ))
}

private data class CatalogEdit(val original: JSONObject?)

@Composable
internal fun AdminCatalog(vm: AppVm, state: JSONObject, area: CatalogArea) {
    var query by remember(area) { mutableStateOf("") }
    var editing by remember(area) { mutableStateOf<CatalogEdit?>(null) }
    var remove by remember(area) { mutableStateOf<JSONObject?>(null) }
    val records = state.optJSONArray(area.group).objects().filter { item ->
        (area != CatalogArea.Stock || item.str("powderAgent").isEmpty()) &&
            listOf("name", "category", "type", "model", "kg").any { item.str(it).contains(query.trim(), ignoreCase = true) }
    }
    PanelList {
        item { PanelIntro("", area.title) }
        item { PrimaryButton("＋ Cadastrar", enabled = !vm.busy) { editing = CatalogEdit(null) } }
        item { PanelSearch(query, { query = it }, "Buscar nesta seção") }
        if (records.isEmpty()) item { EmptyRecord("Nenhum registro encontrado.") }
        items(records) { entry ->
            CardBox {
                Text(entry.str("name"), fontWeight = FontWeight.ExtraBold)
                val category = entry.str("category")
                if (category.isNotBlank()) Text(category)
                if (area == CatalogArea.Stock) {
                    Text("${entry.str("qty")} ${entry.str("unit")} · mínimo ${entry.str("minQty")}")
                    if (entry.optDouble("qty", 0.0) <= entry.optDouble("minQty", 0.0)) StatusChip("Estoque baixo")
                    Text("Custo unitário · ${formatRegistrationMoney(Math.round(entry.optDouble("unitCost", 0.0) * 100))}")
                } else {
                    if (entry.str("kg").isNotBlank()) Text("${entry.str("kg")} ${entry.str("unit").ifBlank { "kg" }}")
                    Text(formatRegistrationMoney(Math.round(entry.optDouble("price", 0.0) * 100)))
                }
                Row {
                    TextButton(enabled = !vm.busy, onClick = { editing = CatalogEdit(entry) }) { Text("Editar") }
                    if (area != CatalogArea.Stock) {
                        TextButton(enabled = !vm.busy, onClick = { remove = entry }) { Text("Remover") }
                    }
                }
            }
        }
    }
    editing?.let { edit ->
        NativeFieldsDialog(if (edit.original == null) "Cadastrar" else "Editar cadastro", area.fields, edit.original,
            vm.busy, { editing = null }) { values ->
            if (area == CatalogArea.Types) {
                val name = values.str("name")
                val capacity = values.str("kg")
                if (name == "Água pressurizada") values.put("unit", "L")
                if (values.str("unit") !in listOf("kg", "L")) return@NativeFieldsDialog "Use kg ou L para a unidade."
                if (!validStandardCapacity(name, capacity)) return@NativeFieldsDialog "Selecione uma capacidade permitida para este agente."
                if (state.optJSONArray("types").objects().any {
                    it.str("id") != edit.original?.str("id") && it.str("name") == name && it.str("kg") == capacity
                }) return@NativeFieldsDialog "Esse tipo e capacidade já existem."
            }
            vm.saveAdminRecord(area.group, edit.original, values) { editing = null }
            null
        }
    }
    remove?.let { record ->
        AlertDialog(onDismissRequest = { if (!vm.busy) remove = null },
            title = { Text("Remover ${record.str("name")}?") },
            text = { Text("O item sairá do catálogo para novos registros.") },
            confirmButton = {
                TextButton(enabled = !vm.busy, onClick = { vm.removeAdminRecord(area.group, record) { remove = null } }) { Text("Remover") }
            }, dismissButton = { TextButton(onClick = { if (!vm.busy) remove = null }) { Text("Cancelar") } })
    }
}

@Composable
internal fun NativeFieldsDialog(
    title: String, fields: List<CatalogField>, original: JSONObject? = null, busy: Boolean,
    close: () -> Unit, submit: (JSONObject) -> String?
) {
    var values by remember(original, fields) {
        mutableStateOf(fields.associate { it.key to (original?.str(it.key) ?: it.default) })
    }
    var issue by remember(original, fields) { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = { if (!busy) close() }, title = { Text(title) },
        text = {
            Column(Modifier.heightIn(max = 430.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                for (field in fields) {
                    val value = values[field.key].orEmpty()
                    OutlinedTextField(value, { updated ->
                        if (updated.length <= if (field.numeric) 14 else 1500) values = values + (field.key to updated)
                    }, modifier = Modifier.fillMaxWidth(), label = { Text(field.label) }, singleLine = field.key != "description",
                        enabled = !busy, keyboardOptions = KeyboardOptions(keyboardType = if (field.numeric) KeyboardType.Decimal else KeyboardType.Text))
                }
                issue?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(enabled = !busy, onClick = {
                val result = JSONObject()
                for (field in fields) {
                    val value = values[field.key].orEmpty().trim()
                    if (value.isBlank() && !field.optional) {
                        issue = "Preencha ${field.label.lowercase()}."
                        return@TextButton
                    }
                    if (field.numeric) {
                        val number = value.replace(',', '.').toDoubleOrNull()
                        if (number == null || !number.isFinite() || number !in 0.0..1_000_000.0) {
                            issue = "Confira ${field.label.lowercase()}."
                            return@TextButton
                        }
                        result.put(field.key, number)
                    } else result.put(field.key, value)
                }
                issue = submit(result)
            }) { Text("Salvar") }
        },
        dismissButton = { TextButton(onClick = { if (!busy) close() }) { Text("Cancelar") } })
}

private fun validStandardCapacity(type: String, capacity: String): Boolean = when (type) {
    "Água pressurizada" -> capacity.isEmpty()
    "Pó químico ABC", "Pó químico BC" -> capacity in setOf("1", "2", "4", "6", "8", "12", "20", "30", "50")
    "CO₂" -> capacity in setOf("2", "4", "6", "10")
    else -> capacity.toDoubleOrNull()?.let { it > 0 && it.isFinite() } == true
}
