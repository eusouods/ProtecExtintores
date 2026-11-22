package br.com.protecextintores.nativo

import android.util.Base64
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONObject

internal data class WalletOwner(val role: String, val id: String, val name: String)
private data class BillAction(val action: String, val target: JSONObject, val group: Boolean = false)

@Composable
internal fun TeamWallet(refresh: Int, owner: WalletOwner? = null, onSettled: () -> Unit = {}) {
    val endpoint = if (owner == null) "/api/team/billing" else "/api/admin/team-billing"
    val getPath = remember(owner) {
        if (owner == null) endpoint else {
            val url = (Api.BASE + endpoint).toHttpUrl().newBuilder()
                .addQueryParameter("role", owner.role).addQueryParameter("id", owner.id).build()
            "$endpoint?${url.encodedQuery}"
        }
    }
    val token = Store.token
    val scope = rememberCoroutineScope()
    var result by remember(token, owner) { mutableStateOf<Api.ApiResult?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    var pending by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf("") }
    var action by remember { mutableStateOf<BillAction?>(null) }
    var pix by remember { mutableStateOf<JSONObject?>(null) }
    LaunchedEffect(token, getPath, refresh, reload) { result = Api.teamSection(token, getPath) }

    fun send(intent: BillAction, reference: String = "") {
        if (pending) return
        pending = true
        notice = ""
        val payload = JSONObject().put("action", intent.action)
            .put(if (intent.group) "groupId" else "billId", intent.target.str("id"))
        if (owner != null) payload.put("role", owner.role).put("id", owner.id)
        if (reference.isNotBlank()) payload.put("reference", reference.trim())
        scope.launch {
            try {
                val response = Api.postSection(token, endpoint, payload)
                if (token != Store.token) return@launch
                if (!response.ok) {
                    notice = response.error.ifEmpty { "Não foi possível processar o acerto." }
                    reload++
                    return@launch
                }
                if (intent.action == "pix" && response.json.str("payload").isNotBlank()) pix = response.json
                if (intent.action == "report") notice = "Aviso enviado. O administrador ainda precisa conferir o recebimento."
                if (intent.action == "settle") {
                    notice = "Recebimento confirmado."
                    onSettled()
                }
                if (intent.action != "pix") pix = null
                reload++
            } finally {
                pending = false
            }
        }
    }

    val response = result
    val wallet = response?.json
    PanelList {
        item { PanelIntro("ACERTOS", owner?.name ?: "Meus pagamentos à Protec") }
        if (notice.isNotEmpty()) item { EmptyRecord(notice) }
        if (response == null || pending) item { CircularProgressIndicator() }
        if (response?.ok == false) {
            item {
                EmptyRecord(response.error.ifEmpty { "Não foi possível carregar os pagamentos." })
                TextButton(onClick = { reload++ }) { Text("Tentar novamente") }
            }
        }
        if (response?.ok == true && wallet != null) {
            val groups = wallet.optJSONArray("groups").objects()
            val (paid, open) = wallet.optJSONArray("bills").objects().partition { it.str("status") == "paid" }
            item { PanelMetrics(listOf(
                PanelMetric("Saldo a pagar", formatRegistrationMoney(wallet.optLong("balanceCents"))),
                PanelMetric("Pagamentos confirmados", formatRegistrationMoney(wallet.optLong("paidCents")))
            )) }
            val configured = wallet.optBoolean("pixConfigured")
            if (!configured) item { EmptyRecord("O Pix da empresa precisa ser configurado para gerar novos acertos.") }
            item { Text("Acertos pendentes", style = MaterialTheme.typography.titleLarge) }
            if (groups.isEmpty() && open.isEmpty()) item { EmptyRecord("Nenhum acerto pendente.") }
            items(groups) { group ->
                BillCard(group, true) {
                    if (group.optBoolean("eligible")) {
                        PrimaryButton("Gerar Pix", enabled = configured && !pending) { action = BillAction("pix", group, true) }
                    } else Text("Pix disponível em ${group.str("dueDate")}.")
                }
            }
            items(open) { bill ->
                BillCard(bill, false) {
                    when (bill.str("status")) {
                        "pending" -> {
                            if (bill.str("reportedAt").isNotBlank()) Text("Pagamento informado. Aguardando conferência.")
                            PrimaryButton("Ver Pix", enabled = !pending) { send(BillAction("pix", bill)) }
                            if (owner != null) {
                                TextButton(enabled = !pending, onClick = { action = BillAction("settle", bill) }) {
                                    Text("Conferir recebimento")
                                }
                            } else {
                                TextButton(enabled = !pending, onClick = { action = BillAction("report", bill) }) {
                                    Text("Já paguei · avisar administrador")
                                }
                            }
                        }
                        else -> Text("Acerto em revisão pela administração.")
                    }
                }
            }
            item { Text("Ordens em andamento", style = MaterialTheme.typography.titleLarge) }
            val orders = wallet.optJSONArray("openOrders").objects()
            if (orders.isEmpty()) item { EmptyRecord("Nenhuma ordem própria em andamento.") }
            items(orders) { order ->
                CardBox {
                    Text(order.str("code") + " · " + order.str("clientName"), fontWeight = FontWeight.Bold)
                    Text(if (order.optBoolean("pricingPending")) "Valor interno a definir"
                        else formatRegistrationMoney(order.optLong("amountCents")) + " · estimativa interna")
                }
            }
            item { Text("Histórico de pagamentos", style = MaterialTheme.typography.titleLarge) }
            val old = wallet.optJSONArray("otherPayments").objects()
            if (paid.isEmpty() && old.isEmpty()) item { EmptyRecord("Nenhum pagamento confirmado.") }
            items(paid + old) { bill -> BillCard(bill, false) { Text(bill.str("reference")) } }
        }
    }
    pix?.let { bill ->
        val clipboard = LocalClipboardManager.current
        ProtecDialog(onDismissRequest = { pix = null },
            title = { Text("Pix do acerto") },
            text = {
                Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(formatRegistrationMoney(bill.optLong("amountCents")), style = MaterialTheme.typography.headlineSmall)
                    Text(bill.str("merchant") + " · " + bill.str("txid"))
                    PixCode(bill.str("qr"))
                    SelectionContainer { Text(bill.str("payload"), style = MaterialTheme.typography.bodySmall) }
                    Text("Confira o recebedor e o valor no aplicativo do banco.",
                        style = MaterialTheme.typography.bodySmall)
                    TextButton(onClick = {
                        pix = null
                        action = BillAction(if (owner == null) "report" else "settle", bill)
                    }) { Text(if (owner == null) "Já paguei · avisar administrador" else "Conferir recebimento") }
                }
            }, confirmButton = { TextButton(onClick = {
                clipboard.setText(AnnotatedString(bill.str("payload")))
                notice = "Código Pix copiado."
            }) { Text("Copiar Pix") } }, dismissButton = { TextButton(onClick = { pix = null }) { Text("Fechar") } })
    }
    action?.let { intent ->
        var reference by remember(intent) { mutableStateOf("") }
        val title = when (intent.action) {
            "pix" -> "Gerar Pix do acerto"
            "settle" -> "Conferir recebimento"
            else -> "Informar pagamento realizado"
        }
        ProtecDialog(onDismissRequest = { action = null }, title = { Text(title) }, text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(formatRegistrationMoney(intent.target.optLong("amountCents")), fontWeight = FontWeight.Bold)
                when (intent.action) {
                    "pix" -> Text("O código será gerado para as ordens deste acerto.")
                    "settle" -> Text("Confirme somente após conferir no banco o valor integral recebido.")
                    else -> Text("O administrador vai conferir o recebimento antes de confirmar o pagamento.")
                }
                if (intent.action != "pix") {
                    OutlinedTextField(reference, { if (it.length <= 300) reference = it },
                        label = { Text("Referência do pagamento") }, modifier = Modifier.fillMaxWidth())
                }
            }
        }, confirmButton = {
            TextButton(enabled = !pending && (intent.action == "pix" || reference.trim().length >= 3),
                onClick = { action = null; send(intent, reference) }) { Text("Confirmar") }
        }, dismissButton = { TextButton(onClick = { action = null }) { Text("Cancelar") } })
    }
}

@Composable
private fun BillCard(bill: JSONObject, group: Boolean, content: @Composable () -> Unit) {
    val orders = bill.optJSONArray("orders").objects()
    val weekly = bill.optJSONObject("policy")?.str("mode") == "weekly"
    val title = if (weekly) if (group) "Acerto semanal" else "Acerto semanal fechado"
        else orders.firstOrNull()?.str("code")?.ifBlank { null } ?: bill.str("code").ifBlank { "Acerto" }
    CardBox {
        Text(title, fontWeight = FontWeight.Bold)
        Text(formatRegistrationMoney(bill.optLong("amountCents")), style = MaterialTheme.typography.titleLarge)
        val date = bill.str("paidAt").ifBlank { bill.str("dueDate") }.take(10)
        if (date.isNotBlank()) Text(date)
        if (orders.isNotEmpty()) {
            var expanded by remember { mutableStateOf(false) }
            TextButton(onClick = { expanded = !expanded }) {
                Text(if (expanded) "Ocultar ordens" else "Ver ordens incluídas (${orders.size})")
            }
            if (expanded) orders.forEach { Text(it.str("code") + " · " + formatRegistrationMoney(it.optLong("amountCents"))) }
        }
        content()
    }
}

/** Read only the black modules generated by the API. No SVG or embedded content is executed. */
@Composable
private fun PixCode(data: String) {
    val image = remember(data) {
        runCatching {
            val prefix = "data:image/svg+xml;base64,"
            require(data.startsWith(prefix) && data.length < 1_000_000)
            val svg = String(Base64.decode(data.removePrefix(prefix), Base64.DEFAULT), Charsets.UTF_8)
            val side = Regex("""viewBox="0 0 (\d+) \d+"""").find(svg)?.groupValues?.get(1)?.toInt() ?: error("QR")
            require(side in 21..190)
            val black = Regex("""fill="#000" d="([^"]+)"""").find(svg)?.groupValues?.get(1) ?: error("QR")
            val points = Regex("""M(\d+) (\d+)h1v1h-1z""").findAll(black)
                .map { it.groupValues[1].toInt() to it.groupValues[2].toInt() }.toList()
            require(points.isNotEmpty() && points.all { (x, y) -> x in 4 until side - 4 && y in 4 until side - 4 })
            side to points
        }.getOrNull()
    } ?: return
    Canvas(Modifier.fillMaxWidth().aspectRatio(1f).padding(5.dp)
        .semantics { contentDescription = "QR Code Pix" }) {
        drawRect(Color.White)
        val unit = kotlin.math.floor(size.minDimension / image.first).coerceAtLeast(1f)
        val startX = (size.width - unit * image.first) / 2f
        val startY = (size.height - unit * image.first) / 2f
        for ((x, y) in image.second) drawRect(Color.Black,
            topLeft = Offset(startX + x * unit, startY + y * unit), size = Size(unit, unit))
    }
}
