package br.com.protecextintores.nativo

import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.font.FontWeight
import org.json.JSONObject

private data class SuggestedPrice(val label: String, val price: Double, val key: JSONObject)

@Composable
internal fun AdminPrices(vm: AppVm, state: JSONObject) {
    val token = Store.token
    var result by remember(token) { mutableStateOf<Api.ApiResult?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    var query by remember { mutableStateOf("") }
    var selected by remember { mutableStateOf<SuggestedPrice?>(null) }
    LaunchedEffect(token, reload) { result = Api.teamSection(token, "/api/offline/admin/registration-catalog") }
    val response = result
    val data = response?.json?.optJSONObject("registrationCatalog")
    PanelList {
        item { PanelIntro("PÓ, PREÇOS E ENVIOS", "Preços sugeridos", "Consulte e altere os valores sugeridos para os próximos registros.") }
        when {
            response == null -> item { Text("Carregando preços…") }
            !response.ok || data == null -> item {
                EmptyRecord(response.error.ifBlank { "Não foi possível carregar o catálogo." })
                ExpressiveTextButton(onClick = { reload++ }) { Text("Tentar novamente") }
            }
            else -> {
                item { PanelSearch(query, { query = it }, "Buscar tipo, capacidade, peça ou serviço") }
                val rows = suggestedPrices(state, data).filter { matches(JSONObject().put("name", it.label), query) }
                if (rows.isEmpty()) item { EmptyRecord("Nenhum preço encontrado.") }
                items(rows) { row ->
                    CardBox {
                        Text(row.label, fontWeight = FontWeight.Bold)
                        Text(if (row.price > 0) formatRegistrationMoney(Math.round(row.price * 100)) else "Preço a definir")
                        SoftButton("Editar preço", enabled = !vm.busy) { selected = row }
                    }
                }
            }
        }
    }
    selected?.let { row ->
        val fields = remember { listOf(CatalogField("price", "Valor por unidade (R$)", numeric = true)) }
        val original = remember(row) { JSONObject().put("price", row.price.takeIf { it > 0 } ?: "") }
        NativeFieldsDialog(row.label, fields, original, vm.busy, { selected = null }) { values ->
            val price = values.optDouble("price", 0.0)
            if (price < 0.01) "Informe um preço a partir de R$ 0,01."
            else {
                val payload = JSONObject(row.key.toString()).put("price", price).put("action", "suggested-price")
                vm.adminAction("/api/admin/operations", payload, "Preço sugerido atualizado.") {
                    selected = null
                    reload++
                }
                null
            }
        }
    }
}

private fun suggestedPrices(state: JSONObject, data: JSONObject): List<SuggestedPrice> = buildList {
    fun entry(kind: String, label: String, price: Double, vararg fields: Pair<String, Any>) {
        val key = JSONObject().put("kind", kind)
        for ((name, value) in fields) key.put(name, value)
        add(SuggestedPrice(label, price.takeIf { it.isFinite() } ?: 0.0, key))
    }
    for (group in listOf("equipment", "sales")) {
        for (item in data.optJSONArray(group).objects()) {
            val type = item.str("type")
            val kg = item.str("kg")
            val label = "$type ${item.str("label").ifBlank { if (kg.isBlank()) "10 L" else "$kg kg" }}"
            val price = item.optDouble("price", 0.0)
            if (group == "equipment") entry("maintenance", "Manutenção · $label", price, "type" to type, "kg" to kg)
            else {
                val condition = item.str("condition")
                val sale = if (condition == "new") "Novo lacrado" else "Seminovo revisado"
                entry("sale", "$sale · $label", price, "type" to type, "kg" to kg, "condition" to condition)
            }
        }
    }
    for (part in data.optJSONArray("parts").objects()) {
        val name = part.str("name")
        entry("part", "Peça · $name", part.optDouble("price", 0.0), "name" to name)
    }
    val painting = state.optJSONArray("costCatalog").objects().firstOrNull { it.str("name") == "Pintura" && it.optBoolean("active", true) }
    val paintDefault = state.optJSONObject("settings")?.optJSONObject("partPrices")?.optDouble("Pintura", 7.0) ?: 7.0
    entry("painting", "Pintura por extintor", painting?.optDouble("salePrice", paintDefault) ?: paintDefault)
    entry("hose", "Teste de mangueira de hidrante por unidade", data.optDouble("hoseDefaultPrice", 0.0))
    for (service in data.optJSONArray("complements").objects().filter { it.str("placement") != "equipment" }) {
        val variants = service.optJSONArray("variants") ?: continue
        val name = service.str("name")
        for (variant in variants.stringList()) {
            entry("complement", "$name · $variant", service.optJSONObject("prices")?.optDouble(variant, 0.0) ?: 0.0,
                "catalogId" to service.str("id"), "name" to name, "variants" to variants, "variant" to variant)
        }
    }
    for (product in state.optJSONArray("products").objects()) {
        entry("product", "Catálogo · ${product.str("name")}", product.optDouble("price", 0.0), "id" to product.str("id"))
    }
}
