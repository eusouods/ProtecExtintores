package br.com.protecextintores.nativo

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import org.json.JSONObject

internal data class ReceiptOrder(val service: Svc, val finance: JSONObject) {
    val paid get() = finance.optJSONObject("payment")?.str("status") == "paid"
    val due get() = runCatching { LocalDate.parse(finance.str("dueDate")) }.getOrNull()
    val cents get() = finance.optLong("revenueCents")
}

internal fun eligibleReceipts(state: JSONObject) = state.optJSONArray("services").objects()
    .map(::Svc).filter { it.closed && !it.cancelled }
    .mapNotNull { order -> order.j.optJSONObject("finance")?.let { ReceiptOrder(order, it) } }

@Composable
internal fun AdminReceipts(state: JSONObject, openOrder: (String) -> Unit, openWallet: (WalletOwner) -> Unit) {
    val today = LocalDate.now()
    val receipts = eligibleReceipts(state)
    val (paid, open) = receipts.partition(ReceiptOrder::paid)
    val pending = open.sortedWith(compareBy<ReceiptOrder> { it.due ?: LocalDate.MAX }.thenBy { it.service.code })
    val next = pending.firstOrNull { it.due != null }
    val owners = listOf("employees" to "employee", "sellers" to "seller").flatMap { (field, role) ->
        state.optJSONArray(field).objects().filter { it.str("id").isNotEmpty() }
            .map { WalletOwner(role, it.str("id"), it.str("name").ifBlank { it.str("id") }) }
    }
    val colors = MaterialTheme.colorScheme
    PanelList(spacing = 0.dp) {
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
                    if (pending.isNotEmpty()) PrimaryButton(if (next != null) "Ver próxima cobrança" else "Ver cobrança",
                        Modifier.padding(top = 7.dp)) {
                        openOrder((next ?: pending.first()).service.id)
                    }
                }
            }
        }
        if (pending.isNotEmpty()) {
            item {
                Text("Cobranças em aberto", Modifier.padding(top = 21.dp, bottom = 8.dp),
                    style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            }
            items(pending, key = { it.service.id }) { receipt ->
                ReceiptLine(receipt, today, receipt == next, receipt == pending.first(), receipt == pending.last()) {
                    openOrder(receipt.service.id)
                }
            }
        }
        item {
            Text("Resultado", Modifier.padding(top = 21.dp, bottom = 8.dp),
                style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
        item {
            PanelMetrics(listOf(
                PanelMetric("Recebido", formatRegistrationMoney(paid.sumOf(ReceiptOrder::cents))),
                PanelMetric("Custos registrados", formatRegistrationMoney(receipts.sumOf { it.finance.optLong("costCents") })),
                PanelMetric("Ordens finalizadas", receipts.size.toString())
            ))
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
    val chargeOwner = receipt.finance.optJSONObject("payer")?.str("name").orEmpty()
        .ifBlank { receipt.service.j.optJSONObject("billingOwner")?.str("name").orEmpty() }
    val name = chargeOwner.ifBlank { receipt.service.client }.ifBlank { receipt.service.code }
    val statusInk = if (colors.background.luminance() > .5f) Color(0xFF76510C) else Color(0xFFFFDC91)
    val top = if (first) 14.dp else 0.dp
    val bottom = if (last) 14.dp else 0.dp
    Surface(onClick = open, color = colors.surface, shape = RoundedCornerShape(top, top, bottom, bottom),
        border = BorderStroke(.5.dp, colors.outline)) {
        Row(Modifier.fillMaxWidth().heightIn(min = 66.dp).padding(horizontal = 11.dp, vertical = 9.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(name, fontWeight = FontWeight.SemiBold)
                Text("${if (chargeOwner.isBlank()) receipt.service.type.ifBlank { receipt.service.code } else receipt.service.code} · $displayDate",
                    style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(formatRegistrationMoney(receipt.cents), fontWeight = FontWeight.SemiBold)
                if (status.isNotBlank()) Text(status, style = MaterialTheme.typography.bodySmall, color = statusInk)
            }
        }
    }
}
