package br.com.protecextintores.nativo

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import java.util.Locale
import java.util.UUID

internal fun equipmentCode(id: String) = "PX-" + id.replace("-", "").take(12).uppercase(Locale.ROOT)

internal fun equipmentTitle(asset: JSONObject): String = listOf(
    asset.str("type"), asset.str("kg").takeIf { it.isNotEmpty() }?.let { "$it kg" }
        ?: if (asset.str("type") == "Água pressurizada") "10 L" else "",
    asset.str("location"), asset.str("area"), asset.str("serial")
).filter { it.isNotBlank() }.joinToString(" · ")

private data class RegistryEdit(
    val action: String, val original: JSONObject? = null,
    val id: String = original?.str("id") ?: UUID.randomUUID().toString()
)

@Composable
internal fun AdminEquipmentRegistry(vm: AppVm, state: JSONObject, client: JSONObject,
                                    openOrder: (String) -> Unit, close: () -> Unit) {
    val clientId = client.str("id")
    val registry = state.optJSONObject("equipmentRegistry") ?: JSONObject()
    val locations = registry.optJSONArray("locations").objects().filter { it.str("clientId") == clientId }
    val equipment = registry.optJSONArray("equipment").objects().filter { it.str("clientId") == clientId }
    val services = state.optJSONArray("services").objects().filter { it.str("clientId") == clientId }
    var editing by remember(clientId) { mutableStateOf<RegistryEdit?>(null) }
    var catalog by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var catalogError by remember { mutableStateOf("") }
    var retry by remember { mutableStateOf(0) }
    BackHandler(enabled = editing == null && !vm.busy, onBack = close)
    LaunchedEffect(clientId, retry) {
        catalogError = ""
        val result = Api.teamSection(Store.token, "/api/offline/admin/registration-catalog")
        catalog = RegistrationCatalog(result.json).equipment.filter { it.optBoolean("maintenanceAllowed", true) }
        if (!result.ok) catalogError = result.error.ifEmpty { "Catálogo indisponível. Confira a conexão." }
    }
    PanelList {
        item {
            ExpressiveTextButton(onClick = close) { Text("Voltar aos clientes") }
            PanelIntro("", "Equipamentos", client.str("name"))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ExpressiveOutlinedButton(enabled = !vm.busy, onClick = { editing = RegistryEdit("equipment-location") }) {
                    Text("Novo local")
                }
                if (locations.isNotEmpty()) ExpressiveOutlinedButton(enabled = !vm.busy && catalog.isNotEmpty(),
                    onClick = { editing = RegistryEdit("equipment-save") }) { Text("Novo equipamento") }
            }
            if (catalogError.isNotBlank()) {
                Text(catalogError)
                ExpressiveTextButton(onClick = { retry++ }) { Text("Recarregar catálogo") }
            }
        }
        if (locations.isEmpty()) item { EmptyRecord("Cadastre o primeiro endereço para adicionar equipamentos.") }
        for (location in locations) item(key = location.str("id")) {
            CardBox {
                Text(location.str("name"), fontWeight = FontWeight.ExtraBold)
                Text(location.str("address"))
                ExpressiveTextButton(enabled = !vm.busy, onClick = { editing = RegistryEdit("equipment-location", location) }) {
                    Text("Editar local")
                }
                val assets = equipment.filter { it.str("locationId") == location.str("id") }
                if (assets.isEmpty()) Text("Nenhum equipamento neste local.")
                for (asset in assets) {
                    HorizontalDivider()
                    val archived = asset.str("archivedAt").isNotBlank()
                    Text(equipmentTitle(asset), fontWeight = FontWeight.SemiBold)
                    Text(equipmentCode(asset.str("id")), style = MaterialTheme.typography.bodySmall)
                    val month = asset.str("nextMonth")
                    Text(when {
                        archived -> "Arquivado"
                        month.length == 7 -> "Próxima manutenção · " + month.takeLast(2) + "/" + month.take(4)
                        else -> "Sem previsão de manutenção"
                    }, style = MaterialTheme.typography.bodySmall)
                    if (asset.str("notes").isNotBlank()) Text(asset.str("notes"))
                    val orders = services.filter { order -> order.optJSONArray("items").objects().any { it.str("equipmentId") == asset.str("id") } }
                        .sortedByDescending { it.str("date") }
                    for (order in orders) {
                        ExpressiveTextButton(onClick = { openOrder(order.str("id")) }) {
                            Text(listOf(order.str("code"), order.str("date")).joinToString(" · "))
                        }
                    }
                    if (!archived) FlowRow {
                        ExpressiveTextButton(enabled = !vm.busy && catalog.isNotEmpty(),
                            onClick = { editing = RegistryEdit("equipment-save", asset) }) { Text("Editar") }
                        ExpressiveTextButton(enabled = !vm.busy,
                            onClick = { editing = RegistryEdit("equipment-archive", asset) }) { Text("Arquivar") }
                    }
                }
            }
        }
    }
    editing?.let { current ->
        RegistryDialog(vm, current, clientId, locations, catalog) { editing = null }
    }
}

@Composable
private fun RegistryDialog(vm: AppVm, edit: RegistryEdit, clientId: String,
                           locations: List<JSONObject>, catalog: List<JSONObject>, close: () -> Unit) {
    val isLocation = edit.action == "equipment-location"
    val archive = edit.action == "equipment-archive"
    val record = edit.original ?: JSONObject()
    var fields by remember(edit.id) { mutableStateOf(
        listOf("name", "address", "area", "serial", "nextMonth", "notes").associateWith(record::str)
    ) }
    var locationId by remember(edit.id) { mutableStateOf(record.str("locationId").ifBlank { locations.firstOrNull()?.str("id").orEmpty() }) }
    var model by remember(edit.id) { mutableStateOf(catalog.indexOfFirst { it.str("type") == record.str("type") && it.str("kg") == record.str("kg") }) }
    var error by remember(edit.id) { mutableStateOf("") }
    val title = when {
        archive -> "Arquivar equipamento"
        isLocation && edit.original != null -> "Editar local"
        isLocation -> "Novo local"
        edit.original != null -> "Editar equipamento"
        else -> "Novo equipamento"
    }
    ProtecDialog(onDismissRequest = { if (!vm.busy) close() }, title = { Text(title) }, text = {
        Column(Modifier.fillMaxWidth().heightIn(max = 410.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (archive) Text("A ficha e o histórico ficam guardados. O equipamento sai da seleção de novas ordens.")
            else if (!isLocation) {
                Pick("Local", locationId, locations.map { SheetOption(it.str("id"), it.str("name")) }) { locationId = it }
                Pick("Tipo e capacidade", model.toString(), catalog.mapIndexed { i, option ->
                    SheetOption(i.toString(), option.str("type") + " · " + option.str("label"))
                }) { model = it.toInt() }
            }
            val inputs = if (archive) emptyList() else if (isLocation) listOf(
                Triple("name", "Nome do local", 100), Triple("address", "Endereço", 200)
            ) else listOf(
                Triple("area", "Ponto de instalação", 100), Triple("serial", "Número de série", 100),
                Triple("nextMonth", "Próxima manutenção (AAAA-MM)", 7), Triple("notes", "Observações", 600)
            )
            for ((key, label, max) in inputs) {
                OutlinedTextField(fields[key].orEmpty(), { input ->
                    if (input.length <= max) fields = fields + (key to input)
                }, label = { Text(label) }, modifier = Modifier.fillMaxWidth(), singleLine = key != "notes")
            }
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
        }
    }, confirmButton = {
        ExpressiveTextButton(enabled = !vm.busy, onClick = {
            error = when {
                archive -> ""
                isLocation && listOf("name", "address").any { fields[it].isNullOrBlank() } -> "Informe nome e endereço."
                !isLocation && (locationId.isBlank() || model < 0 || fields["area"].isNullOrBlank()) ->
                    "Escolha local, tipo e capacidade e informe o ponto de instalação."
                !isLocation && !fields["nextMonth"].isNullOrBlank() &&
                    !fields["nextMonth"].orEmpty().matches(Regex("20[0-9]{2}-(0[1-9]|1[0-2])")) -> "Confira o mês da próxima manutenção."
                else -> ""
            }
            if (error.isEmpty()) {
                val data = JSONObject(fields).put("action", edit.action).put("id", edit.id).put("clientId", clientId)
                    .put("expectedUpdatedAt", record.str("updatedAt"))
                if (!isLocation && !archive) {
                    val type = catalog[model]
                    data.put("locationId", locationId).put("type", type.str("type")).put("kg", type.str("kg"))
                }
                vm.adminAction("/api/admin/operations", data, "Ficha atualizada.", close)
            }
        }) { Text(if (archive) "Arquivar" else "Salvar") }
    }, dismissButton = {
        ExpressiveTextButton(enabled = !vm.busy, onClick = close) { Text("Cancelar") }
    })
}
