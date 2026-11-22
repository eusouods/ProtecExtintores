package br.com.protecextintores.nativo

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale
import java.util.UUID

private val powderFields = listOf(
    CatalogField("kg", "Quantidade em kg", numeric = true),
    CatalogField("unitCost", "Custo por kg", numeric = true),
    CatalogField("reference", "Nota ou referência")
)

@Composable
internal fun AdminPowder(vm: AppVm, state: JSONObject) {
    val stock = state.optJSONArray("inventory").objects().filter { it.str("powderAgent") in setOf("ABC", "BC") }
    val current = state.optJSONArray("powderMovements").objects()
    val archive = state.optJSONArray("powderMovementArchive").objects()
    val reversed = (current + archive).filter { it.str("kind") == "entry-reversal" }.map { it.str("reversalOf") }.toSet()
    val kilograms = remember {
        NumberFormat.getNumberInstance(Locale.forLanguageTag("pt-BR")).apply { maximumFractionDigits = 3 }
    }
    var archived by remember { mutableStateOf(false) }
    var entry by remember { mutableStateOf<Pair<String, String>?>(null) }
    var correction by remember { mutableStateOf<JSONObject?>(null) }
    var clearing by remember { mutableStateOf<JSONObject?>(null) }

    PanelList {
        item { PanelIntro("ESTOQUE", "Pó e movimentações") }
        items(stock) { row ->
            val agent = row.str("powderAgent")
            CardBox {
                Text("Pó $agent", fontWeight = FontWeight.Bold)
                Text("${kilograms.format(row.optDouble("qty", 0.0))} kg em estoque")
                row.optDouble("unitCost").takeIf { it.isFinite() }?.let {
                    Text("Custo médio · ${formatRegistrationMoney(Math.round(it * 100))} por kg")
                }
                SoftButton("Registrar entrada de $agent", enabled = !vm.busy) {
                    entry = agent to UUID.randomUUID().toString()
                }
            }
        }
        if (stock.isEmpty()) item { EmptyRecord("O sistema ainda não tem saldos de pó configurados.") }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                WebFilterChip(!archived, { archived = false }, label = { Text("Movimentações") })
                WebFilterChip(archived, { archived = true }, label = { Text("Arquivo") })
            }
        }
        val movements = if (archived) archive else current
        if (movements.isEmpty()) item { EmptyRecord("Nenhuma movimentação registrada aqui.") }
        if (!archived && current.isNotEmpty()) item {
            SoftButton("Arquivar movimentações", enabled = !vm.busy) {
                clearing = JSONObject().put("action", "powder-history-clear").put("confirm", true)
                    .put("expectedCount", current.size).put("expectedLastId", current.last().str("id"))
                    .put("clearId", UUID.randomUUID().toString())
            }
        }
        items(movements.asReversed()) { movement ->
            CardBox {
                val kind = when (movement.str("kind")) {
                    "entry" -> "Entrada"
                    "entry-reversal" -> "Estorno"
                    "consumption" -> "Consumo"
                    "return" -> "Devolução"
                    else -> "Movimentação"
                }
                Text("$kind · Pó ${movement.str("agent")}", fontWeight = FontWeight.Bold)
                Text("${kilograms.format(movement.optLong("grams") / 1000.0)} kg")
                if (movement.str("reference").isNotBlank()) Text(movement.str("reference"))
                if (movement.str("by").isNotBlank()) Text("Registrado por ${movement.str("by")}")
                if (!archived && movement.str("kind") == "entry" && movement.str("id") !in reversed) {
                    SoftButton("Estornar entrada", enabled = !vm.busy) {
                        correction = JSONObject().put("action", "powder-entry-reverse")
                            .put("entryId", movement.str("id")).put("reversalId", UUID.randomUUID().toString())
                    }
                }
            }
        }
    }
    entry?.let { (agent, id) ->
        NativeFieldsDialog("Registrar entrada de pó $agent", powderFields, busy = vm.busy, close = { entry = null }) { fields ->
            when {
                fields.optDouble("kg", 0.0) !in 0.001..100_000.0 -> "Confira a quantidade de pó."
                fields.str("reference").length !in 3..300 -> "Informe uma referência de 3 a 300 caracteres."
                else -> {
                    fields.put("action", "powder-entry").put("agent", agent).put("entryId", id)
                    vm.adminAction("/api/admin/operations", fields, "Entrada registrada.") { entry = null }
                    null
                }
            }
        }
    }
    correction?.let { payload ->
        PowderConfirmation(vm, "Estornar entrada?", "O sistema vai verificar o saldo e o custo da entrada antes de confirmar o estorno.", payload) {
            correction = null
        }
    }
    clearing?.let { payload ->
        PowderConfirmation(vm, "Arquivar movimentações?", "O saldo e os custos serão preservados. As movimentações continuarão na aba Arquivo.", payload) {
            clearing = null
        }
    }
}

@Composable
private fun PowderConfirmation(vm: AppVm, title: String, description: String, payload: JSONObject, close: () -> Unit) {
    ProtecDialog(
        onDismissRequest = { if (!vm.busy) close() },
        title = { Text(title) },
        text = { Text(description) },
        confirmButton = {
            TextButton(enabled = !vm.busy,
                onClick = { vm.adminAction("/api/admin/operations", payload, "Movimentações atualizadas.", close) }) { Text("Confirmar") }
        },
        dismissButton = { TextButton(enabled = !vm.busy, onClick = close) { Text("Cancelar") } }
    )
}
