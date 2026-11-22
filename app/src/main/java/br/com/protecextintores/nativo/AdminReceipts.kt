package br.com.protecextintores.nativo

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

internal data class ReceiptOrder(val service: Svc, val finance: JSONObject) {
    val paid get() = finance.optJSONObject("payment")?.str("status") == "paid"
    val due get() = runCatching { LocalDate.parse(finance.str("dueDate")) }.getOrNull()
    val cents get() = finance.optLong("revenueCents")
    val costsComplete get() = finance.optBoolean("costsComplete")
    val payer get() = finance.optJSONObject("payer")?.str("name").orEmpty()
        .ifBlank { ownerName(service.j) }
    val direct get() = finance.optJSONObject("payer") == null && ownerName(service.j).isEmpty()
}

private fun ownerName(order: JSONObject): String {
    if (order.optBoolean("adminOwned")) return ""
    val owner = order.optJSONObject("billingOwner")
    if (owner?.str("role") in listOf("employee", "seller") && !owner?.str("id").isNullOrBlank()) {
        return owner?.str("name").orEmpty().ifBlank { if (owner?.str("role") == "employee") "Funcionário" else "Vendedor" }
    }
    return if (order.str("sellerId").isNotBlank()) order.str("sellerName").ifBlank { "Vendedor" } else ""
}

internal fun eligibleReceipts(state: JSONObject) = state.optJSONArray("services").objects()
    .map(::Svc).filter { it.closed && !it.cancelled }
    .mapNotNull { order -> order.j.optJSONObject("finance")?.let { ReceiptOrder(order, it) } }

@Composable
internal fun AdminReceipts(vm: AppVm, state: JSONObject, openOrder: (String) -> Unit, openWallet: (WalletOwner) -> Unit) {
    val today = LocalDate.now()
    val receipts = eligibleReceipts(state)
    val (paid, open) = receipts.partition(ReceiptOrder::paid)
    val pending = open.sortedWith(compareBy<ReceiptOrder> { it.due ?: LocalDate.MAX }.thenBy { it.service.code })
    val next = pending.firstOrNull { it.due != null }
    val direct = pending.filter { it.direct && it.service.id.isNotBlank() }
    val costs = state.optJSONArray("costCatalog").objects().filter { it.optBoolean("active", true) }
    var entry by remember { mutableStateOf<JSONObject?>(null) }
    var remove by remember { mutableStateOf<JSONObject?>(null) }
    var pay by remember { mutableStateOf<ReceiptOrder?>(null) }
    val owners = listOf("employees" to "employee", "sellers" to "seller").flatMap { (field, role) ->
        state.optJSONArray(field).objects().filter { it.str("id").isNotEmpty() }
            .map { WalletOwner(role, it.str("id"), it.str("name").ifBlank { it.str("id") }) }
    }
    val colors = MaterialTheme.colorScheme
    PanelList(spacing = 0.dp, horizontalPadding = 16.dp) {
        item {
            Surface(shape = RoundedCornerShape(16.dp), color = colors.surface, shadowElevation = 3.dp,
                border = BorderStroke(1.dp, colors.outline), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Total a receber", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold,
                        color = colors.onSurfaceVariant)
                    Text(formatRegistrationMoney(pending.sumOf(ReceiptOrder::cents)), fontSize = 30.sp, lineHeight = 38.sp,
                        fontWeight = FontWeight.Bold, letterSpacing = (-1.1).sp)
                    Text(when (pending.size) {
                        0 -> "Nenhuma cobrança em aberto"
                        1 -> "1 cobrança em aberto"
                        else -> "${pending.size} cobranças em aberto"
                    }, color = colors.onSurfaceVariant)
                    val featured = next ?: pending.firstOrNull()
                    if (featured != null) ExpressiveButton(onClick = { openOrder(featured.service.id) }, modifier = Modifier.padding(top = 7.dp)) {
                        Text(if (next != null) "Ver próxima cobrança" else "Ver cobrança")
                    }
                }
            }
        }
        if (pending.isNotEmpty()) {
            item {
                Text("Cobranças em aberto", Modifier.padding(top = 21.dp, bottom = 8.dp),
                    style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            }
            items(pending) { receipt ->
                ReceiptLine(receipt, today, receipt == next, receipt == pending.first(), receipt == pending.last()) {
                    openOrder(receipt.service.id)
                }
            }
        }
        item {
            Box(Modifier.fillMaxWidth().padding(top = 20.dp, bottom = 20.dp), contentAlignment = Alignment.CenterEnd) {
                ExpressiveTonalButton(onClick = { entry = JSONObject().put("id", UUID.randomUUID().toString()) }, enabled = !vm.busy) {
                    Text("Adicionar item")
                }
            }
        }
        item {
            ReceiptsResults(receipts, paid, pending)
        }
        if (direct.isNotEmpty()) {
            item {
                Column(Modifier.padding(top = 20.dp, bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Recebimentos diretos a conferir", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("Finalizar uma ordem não confirma que o pagamento foi recebido.", style = MaterialTheme.typography.bodySmall)
                }
            }
            items(direct) { receipt ->
                CardBox(Modifier.padding(bottom = 8.dp)) {
                    Text("${receipt.service.code} · ${receipt.service.client.ifBlank { "Cliente não informado" }}", fontWeight = FontWeight.SemiBold)
                    Text(formatRegistrationMoney(receipt.cents))
                    ExpressiveTonalButton(onClick = { pay = receipt }, enabled = !vm.busy) { Text("Registrar recebimento") }
                }
            }
        }
        item {
            Text("Itens: custo e valor cobrado", Modifier.padding(top = 21.dp, bottom = 8.dp),
                style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
        if (costs.isEmpty()) item { EmptyRecord("Cadastre os custos reais da empresa para calcular os resultados.") }
        items(costs) { cost ->
            Column(Modifier.padding(bottom = 8.dp)) {
                CardBox {
                    Text(listOf(cost.str("name"), cost.str("kg")).filter(String::isNotBlank).joinToString(" · "), fontWeight = FontWeight.Bold)
                    if (cost.str("category").isNotBlank()) Text(cost.str("category"), color = colors.onSurfaceVariant)
                    val unitCost = Math.round(cost.optDouble("unitCost", 0.0) * 100)
                    val salePrice = Math.round(cost.optDouble("salePrice", 0.0) * 100)
                    Text("Custo ${formatRegistrationMoney(unitCost)} · Cobrado ${formatRegistrationMoney(salePrice)}")
                    FlowRow {
                        ExpressiveTextButton(onClick = { entry = cost }, enabled = !vm.busy) { Text("Editar") }
                        ExpressiveTextButton(onClick = { remove = cost }, enabled = !vm.busy) { Text("Remover") }
                    }
                }
            }
        }
        if (owners.isNotEmpty()) item {
            Text("Acertos da equipe", Modifier.padding(top = 21.dp, bottom = 8.dp), style = MaterialTheme.typography.titleLarge)
        }
        items(owners) { owner ->
            Column(Modifier.padding(bottom = 9.dp)) {
                PanelShortcut(owner.name, if (owner.role == "employee") "Funcionário" else "Vendedor", PanelIcon.Wallet) { openWallet(owner) }
            }
        }
    }
    entry?.let { item ->
        NativeFieldsDialog("Item de custo e cobrança", costFields, item, vm.busy, { entry = null }) { fields ->
            fields.put("action", "save-catalog").put("id", item.str("id"))
            vm.adminAction("/api/admin/operations", fields, "Item de custo salvo.") { entry = null }
            null
        }
    }
    remove?.let { item ->
        ProtecDialog(onDismissRequest = { if (!vm.busy) remove = null }, title = { Text("Remover ${item.str("name")}?") },
            text = { Text("Os lançamentos já fechados serão preservados.") },
            confirmButton = {
                ExpressiveButton(enabled = !vm.busy, onClick = {
                    vm.adminAction("/api/admin/operations", JSONObject().put("action", "remove-catalog").put("id", item.str("id")),
                        "Item removido.") { remove = null }
                }) { Text("Remover") }
            }, dismissButton = { ExpressiveTextButton(enabled = !vm.busy, onClick = { remove = null }) { Text("Cancelar") } })
    }
    pay?.let { receipt -> RecordReceiptDialog(vm, receipt.service, receipt.cents) { pay = null } }
}

private val costFields = listOf(
    CatalogField("name", "Nome", maxLength = 150),
    CatalogField("category", "Categoria", optional = true, maxLength = 60),
    CatalogField("kg", "Capacidade / peso (opcional)", optional = true, maxLength = 12),
    CatalogField("unitCost", "Custo unitário pago (R$)", numeric = true),
    CatalogField("salePrice", "Valor cobrado por unidade (R$)", numeric = true),
    CatalogField("technicalPart", "Disponível como peça para o técnico (exige vídeo)", toggle = true, default = "false")
)

@Composable
internal fun RecordReceiptDialog(vm: AppVm, service: Svc, cents: Long, close: () -> Unit) {
    var reference by remember(service.id) { mutableStateOf("") }
    ProtecDialog(
        onDismissRequest = { if (!vm.busy) close() }, title = { Text("Registrar recebimento") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("${service.code} · ${service.client.ifBlank { "Cliente não informado" }}")
                Text("Valor integral · ${formatRegistrationMoney(cents)}", fontWeight = FontWeight.Bold)
                Text("Confirme após conferir o pagamento recebido.")
                OutlinedTextField(reference, { if (it.length <= 300) reference = it }, Modifier.fillMaxWidth(),
                    label = { Text("Referência do pagamento") }, enabled = !vm.busy)
            }
        },
        confirmButton = {
            ExpressiveButton(enabled = !vm.busy && reference.trim().length >= 3, onClick = {
                vm.adminAction("/api/admin/operations", JSONObject().put("action", "mark-paid")
                    .put("serviceIds", JSONArray(listOf(service.id))).put("reference", reference.trim()),
                    "Recebimento registrado.", close)
            }) { Text("Confirmar recebimento") }
        },
        dismissButton = { ExpressiveTextButton(enabled = !vm.busy, onClick = close) { Text("Cancelar") } }
    )
}

@Composable
private fun ReceiptsResults(all: List<ReceiptOrder>, paid: List<ReceiptOrder>, pending: List<ReceiptOrder>) {
    val colors = MaterialTheme.colorScheme
    val metrics = listOf(
        Triple("Recebido", paid.sumOf(ReceiptOrder::cents), "Pagamentos confirmados"),
        Triple("A receber", pending.sumOf(ReceiptOrder::cents), "Inclui recebimentos não registrados"),
        Triple("Resultado bruto realizado", paid.filter { it.costsComplete }.sumOf { it.finance.optLong("profitCents") }, "Ordens pagas com custos completos"),
        Triple("Resultado bruto previsto", all.filter { it.costsComplete }.sumOf { it.finance.optLong("profitCents") }, "Ordens finalizadas com custos completos")
    )
    CardBox {
        Text("Resultados e recebimentos", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val perRow = if (maxWidth < 252.dp || LocalDensity.current.fontScale >= 1.35f) 1 else 2
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                metrics.chunked(perRow).forEach { group ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        group.forEach { (label, value, note) ->
                            Surface(Modifier.weight(1f), color = colors.surface,
                                shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, colors.outline)) {
                                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                    Text(label, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                                    Text(formatRegistrationMoney(value), style = MaterialTheme.typography.titleLarge.copy(fontFeatureSettings = "tnum"),
                                        fontWeight = FontWeight.Bold)
                                    Text(note, style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
                                }
                            }
                        }
                    }
                }
            }
        }
        val missing = all.count { !it.costsComplete }
        val cost = formatRegistrationMoney(all.sumOf { it.finance.optLong("costCents") })
        val unrecorded = pending.count { it.finance.optJSONObject("payment")?.str("status") == "not-applicable" }
        Text("Custos registrados: $cost. $missing ordem(ns) com custos incompletos. $unrecorded recebimento(s) direto(s) a registrar.",
            style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
    }
}

@Composable
private fun ReceiptLine(receipt: ReceiptOrder, today: LocalDate, firstDue: Boolean, first: Boolean, last: Boolean, open: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val due = receipt.due
    val displayDate = due?.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) ?: "Sem vencimento"
    val status = when {
        due != null && due < today -> "Vencida"
        firstDue -> "Vence primeiro"
        else -> ""
    }
    val chargeOwner = receipt.payer
    val name = chargeOwner.ifBlank { receipt.service.client }.ifBlank { receipt.service.code }
    val top = if (first) 14.dp else 0.dp
    val bottom = if (last) 14.dp else 0.dp
    val source = remember { MutableInteractionSource() }
    Surface(onClick = open, color = colors.surface, shape = RoundedCornerShape(top, top, bottom, bottom),
        modifier = Modifier.pressLikeWeb(source), interactionSource = source,
        border = BorderStroke(.5.dp, colors.outline)) {
        BoxWithConstraints(Modifier.fillMaxWidth().heightIn(min = 66.dp).padding(horizontal = 11.dp, vertical = 9.dp)) {
            val description: @Composable () -> Unit = {
                Text(name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight(650))
                Text("${if (chargeOwner.isBlank()) receipt.service.type.ifBlank { receipt.service.code } else receipt.service.code} · $displayDate",
                    style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
            }
            val amount: @Composable () -> Unit = {
                Text(formatRegistrationMoney(receipt.cents), style = MaterialTheme.typography.bodyMedium.copy(fontFeatureSettings = "tnum"),
                    fontWeight = FontWeight(650))
                if (status.isNotBlank()) Text(status,
                    modifier = Modifier.background(colors.tertiaryContainer, RoundedCornerShape(6.dp))
                        .padding(horizontal = 6.dp, vertical = 3.dp),
                    style = MaterialTheme.typography.bodySmall, color = colors.onTertiaryContainer)
            }
            if (maxWidth < 255.dp || LocalDensity.current.fontScale >= 1.45f) {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    description()
                    amount()
                }
            } else {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) { description() }
                    Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) { amount() }
                }
            }
        }
    }
}
