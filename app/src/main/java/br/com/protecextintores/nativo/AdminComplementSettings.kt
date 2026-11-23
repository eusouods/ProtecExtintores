package br.com.protecextintores.nativo

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

@Composable
internal fun AdminComplementSettings(settings: JSONObject, busy: Boolean, close: () -> Unit, save: (JSONObject) -> Unit) {
    val token = Store.token
    val configured = remember(settings) { settings.optJSONArray("registrationComplements").objects() }
    var catalog by remember(token) { mutableStateOf<Api.ApiResult?>(null) }
    var editing by remember { mutableStateOf<JSONObject?>(null) }
    var select by remember { mutableStateOf(false) }
    LaunchedEffect(token) {
        catalog = Api.teamSection(token, "/api/offline/admin/registration-catalog")
    }
    val rows = remember(configured, catalog) {
        (configured + catalog?.json?.optJSONObject("registrationCatalog")?.optJSONArray("complements").objects())
            .distinctBy { it.str("id") }.sortedBy { it.str("name") }
    }
    ProtecDialog(onDismissRequest = { if (!busy) close() }, title = { Text("Serviços complementares") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Cadastre os tipos que aparecem no registro de serviço dos três perfis.")
                if (catalog == null) Text("Carregando opções…")
                else if (catalog?.ok == false) Text("Não foi possível carregar as opções padrão. Reabra a tela para tentar novamente.")
                SoftButton("Editar opção", enabled = !busy && rows.isNotEmpty()) { select = true }
                SoftButton("Nova opção", enabled = !busy && configured.size < 100) { editing = JSONObject() }
            }
        }, confirmButton = { ExpressiveTextButton(onClick = close, enabled = !busy) { Text("Fechar") } })
    if (select) ProtecOptions("Opções cadastradas", rows.map {
        val label = it.str("name") + if (it.optBoolean("active", true)) "" else " · desativada"
        SheetOption(it.str("id"), label)
    }, null, close = { select = false }, choose = { id -> editing = rows.firstOrNull { it.str("id") == id } })
    editing?.let { original ->
        val fixedTypes = original.str("id") == "demarcation"
        val fields = remember(fixedTypes) {
            buildList {
                add(CatalogField("name", "Nome", maxLength = 100))
                if (!fixedTypes) add(CatalogField("variants", "Um tipo por linha", maxLength = 10100, multiline = true))
                add(CatalogField("active", "Ativo para novos registros", toggle = true))
            }
        }
        val initial = remember(original) {
            JSONObject().put("name", original.str("name")).put("active", original.optBoolean("active", true))
                .put("variants", original.optJSONArray("variants").strings().joinToString("\n"))
        }
        NativeFieldsDialog("Serviço complementar", fields, initial, busy, { editing = null }) { values ->
            val variants = if (fixedTypes) listOf("Amarela e vermelha")
            else values.str("variants").lineSequence().map(String::trim).filter(String::isNotEmpty).distinct().toList()
            val id = original.str("id").ifBlank { "custom-${UUID.randomUUID()}" }
            when {
                variants.size !in 1..100 || variants.any { it.length > 100 } -> "Informe de 1 a 100 tipos, com até 100 caracteres por linha."
                variants.any { it in setOf("__proto__", "constructor", "prototype") } -> "Escolha outro nome para o tipo."
                configured.size >= 100 && configured.none { it.str("id") == id } -> "O catálogo já tem 100 opções configuradas."
                else -> {
                    val record = JSONObject(original.toString())
                        .put("id", id).put("name", values.str("name")).put("active", values.optBoolean("active"))
                        .put("variants", JSONArray(variants))
                    for (key in listOf("prices", "costs")) {
                        val old = original.optJSONObject(key) ?: continue
                        val kept = JSONObject()
                        for (variant in variants) if (old.has(variant)) kept.put(variant, old.get(variant))
                        record.put(key, kept)
                    }
                    val updated = if (configured.any { it.str("id") == id }) configured.map { if (it.str("id") == id) record else it }
                        else configured + record
                    save(JSONObject().put("registrationComplements", JSONArray(updated)))
                    null
                }
            }
        }
    }
}
