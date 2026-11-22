package br.com.protecextintores.nativo

import android.os.SystemClock
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyItemScope
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.Dp
import org.json.JSONObject
import java.text.NumberFormat
import java.text.Normalizer
import java.time.LocalDate
import java.util.Locale

private val adminTabs = listOf(
    PanelTab("Painel", PanelIcon.Grid, "Visão geral"),
    PanelTab("Manutenções", PanelIcon.Wrench),
    PanelTab("Extintores", PanelIcon.Flame),
    PanelTab("Clientes", PanelIcon.People, "Clientes e vendedores"),
    PanelTab("Pedidos", PanelIcon.List),
    PanelTab("Produtos", PanelIcon.Flame),
    PanelTab("Equipe", PanelIcon.People),
    PanelTab("Recebimentos", PanelIcon.Wallet),
    PanelTab("Estoque", PanelIcon.List),
    PanelTab("Agenda", PanelIcon.Clock),
    PanelTab("Alertas", PanelIcon.List),
    PanelTab("Relatórios", PanelIcon.Chart),
    PanelTab("Histórico da equipe", PanelIcon.Clock),
    PanelTab("Acessos da equipe", PanelIcon.People),
    PanelTab("Pó e movimentações", PanelIcon.List),
    PanelTab("Garantias e avaliações", PanelIcon.List),
    PanelTab("Preços sugeridos", PanelIcon.Chart),
    PanelTab("Envios da equipe", PanelIcon.List)
)
private val adminKeys = mapOf(1 to "services", 2 to "types", 3 to "clients", 4 to "orders", 5 to "products", 6 to "employees")
private val adminDockPages = listOf(0, 1, 7)
private val sellerMore = listOf(
    PanelTab("Catálogo", PanelIcon.Flame),
    PanelTab("Pedidos", PanelIcon.List),
    PanelTab("Meu perfil", PanelIcon.People)
)
private data class AdminNavGroup(val label: String, val icon: PanelIcon, val sections: List<Pair<Int, String>>)
private val maintenanceSections = listOf(1 to "Histórico", 9 to "Próximas manutenções")
private val adminGroups = listOf(
    AdminNavGroup("Estoque e preços", PanelIcon.Box, listOf(8 to "Estoque", 16 to "Preços sugeridos", 14 to "Pó e movimentações", 17 to "Envios da equipe")),
    AdminNavGroup("Alertas e relatórios", PanelIcon.Chart, listOf(10 to "Alertas", 11 to "Relatórios", 7 to "Custos e cobranças")),
    AdminNavGroup("Funcionários e acessos", PanelIcon.People, listOf(6 to "Funcionários", 13 to "Acessos")),
    AdminNavGroup("Histórico da equipe", PanelIcon.Clock, listOf(12 to "Histórico da equipe")),
    AdminNavGroup("Loja e pedidos", PanelIcon.Cart, listOf(5 to "Produtos da loja", 4 to "Pedidos")),
    AdminNavGroup("Garantias e avaliações", PanelIcon.Shield, listOf(15 to "Garantias e avaliações"))
)

@Composable
fun PortalScreen(vm: AppVm) {
    val role = vm.portalRole
    val root = vm.portalState ?: return
    val admin = role == "admin"
    val sellerTabs = teamTabs.toMutableList().apply { this[1] = PanelTab("Ordens", PanelIcon.Wrench, "Ordens de serviço") }
    val tabs = if (admin) adminDockPages.map { if (it == 1) adminTabs[it].copy(label = "Serviços") else adminTabs[it] } else sellerTabs
    var page by rememberSaveable(role) { mutableIntStateOf(0) }
    var refreshKey by remember { mutableIntStateOf(0) }
    var owner by remember { mutableStateOf<WalletOwner?>(null) }
    var serviceId by rememberSaveable { mutableStateOf<String?>(null) }
    var receiptDetail by rememberSaveable { mutableStateOf(false) }
    fun openOrder(id: String, finance: Boolean = false) {
        receiptDetail = finance
        serviceId = id
    }
    var sellerOrder by remember { mutableStateOf<JSONObject?>(null) }
    val openSellerOrder = sellerOrder
    val currentOrder = root.optJSONObject("state")?.optJSONArray("services").objects()
        .firstOrNull { serviceId != null && it.str("id") == serviceId }
    val refresh = { vm.refreshPortal(); refreshKey++; Unit }
    val actions = buildList {
        if (!admin) add(PanelAction("Nova ordem de serviço", PanelIcon.Plus, vm::startRegistration))
        if (admin) {
            add(PanelAction("Extintores", PanelIcon.Flame) { page = 2 })
            add(PanelAction("Clientes e vendedores", PanelIcon.People) { page = 3 })
            adminGroups.forEach { group ->
                add(PanelAction(group.label, group.icon) { page = group.sections.first().first })
            }
            add(PanelAction("Atualizar painel", PanelIcon.Refresh, refresh))
        }
        if (!admin) sellerMore.forEachIndexed { index, tab ->
            add(PanelAction(tab.title, tab.icon) { page = index + 4 })
        }
        if (admin) add(PanelAction("Sair do painel", PanelIcon.Exit) { vm.logout() })
        else addAll(panelActions(vm, refresh))
    }
    val title = if (admin) adminTabs.getOrNull(page)?.title else sellerMore.getOrNull(page - 4)?.title
    val sections = if (!admin || page == 7) emptyList() else if (maintenanceSections.any { it.first == page }) maintenanceSections
    else adminGroups.firstOrNull { group -> group.sections.any { it.first == page } }?.sections.orEmpty()
    PanelChrome(tabs, page, { page = it }, actions,
        refresh = refresh, changeTheme = vm::cycleTheme, team = !admin, title = title,
        dockSection = if (admin) adminDockPages.indexOf(if (page == 9) 1 else page) else page,
        selectDock = { page = if (admin) adminDockPages[it] else it },
        openAlerts = if (admin) ({ page = 10 }) else null, subTabs = sections
    ) { active ->
        if (admin) {
            val state = root.optJSONObject("state") ?: JSONObject()
            when (active) {
                0 -> AdminOverview(state, vm::startRegistration, { openOrder(it.str("id")) }) { page = it }
                1 -> RecordsPage(adminTabs[active].title, state.optJSONArray("services").objects(),
                    filterStatus = true, register = vm::startRegistration, openRecord = { openOrder(it.str("id")) })
                2 -> AdminCatalog(vm, state, CatalogArea.Types)
                3 -> AdminDirectory(vm, state, employees = false)
                4 -> RecordsPage(adminTabs[active].title, state.optJSONArray("orders").objects())
                5 -> AdminCatalog(vm, state, CatalogArea.Products)
                6 -> AdminDirectory(vm, state, employees = true)
                7 -> AdminReceipts(state, { openOrder(it, finance = true) }) { owner = it }
                8 -> AdminStock(vm, state) { page = 14 }
                9 -> AdminAgenda(state) { openOrder(it) }
                10 -> AdminAlerts(state, { openOrder(it) }) { page = 8 }
                11 -> AdminReports(vm, state)
                12 -> AdminTeamHistory(state) { openOrder(it) }
                13 -> AdminAccess(state)
                14 -> AdminPowder(vm, state)
                15 -> AdminCare(vm)
                16 -> AdminPrices(vm, state)
                17 -> AdminTransfers(vm, state) { openOrder(it) }
            }
        } else {
            when (active) {
                0 -> SellerOverview({ page = it }, refreshKey, vm::startRegistration)
                1 -> TeamDataPage("/api/seller/services", "Ordens de serviço", "services", refreshKey,
                    register = vm::startRegistration, openRecord = { sellerOrder = it })
                2 -> TeamDataPage("/api/seller/next-maintenance", "Próximas manutenções", "services", refreshKey)
                3 -> TeamWallet(refreshKey)
                4 -> RecordsPage("Catálogo", root.optJSONArray("products").objects())
                5 -> RecordsPage("Meus pedidos", root.optJSONArray("orders").objects())
                6 -> AccountProfile(vm)
            }
        }
    }
    owner?.let { selectedOwner ->
        val close = { if (!vm.busy) owner = null }
        ProtecSheet(onDismissRequest = close) {
            Column(Modifier.fillMaxSize()) {
                ScreenHeader("Acertos da equipe", close)
                TeamWallet(refreshKey, selectedOwner) { vm.refreshPortal(silent = true) }
            }
        }
    }
    if (admin && currentOrder != null) {
        val close = { if (!vm.busy) serviceId = null }
        ProtecSheet(onDismissRequest = close) {
            AdminServiceScreen(vm, currentOrder, initialTab = if (receiptDetail) 1 else 0, close = close)
        }
    }
    if (!admin && openSellerOrder != null) {
        val token = Store.token
        var profile by remember(openSellerOrder.str("id"), token) { mutableStateOf<Profile?>(null) }
        LaunchedEffect(openSellerOrder.str("id"), token) {
            val result = Api.bootstrap(token)
            if (result.ok && Store.token == token && result.json.str("role") == "seller") profile = Profile(result.json)
        }
        val close = { sellerOrder = null }
        ProtecSheet(onDismissRequest = close) {
            AdminServiceScreen(vm, openSellerOrder, readOnly = true, staffProfile = profile,
                afterTransfer = { refreshKey++; close() }, close = close)
        }
    }
}

@Composable
private fun AdminOverview(state: JSONObject, register: () -> Unit, openService: (JSONObject) -> Unit, select: (Int) -> Unit) {
    val services = state.optJSONArray("services").objects().map(::Svc)
    val pending = services.count { it.employeeCompleted && !it.closed && !it.cancelled }
    val unpaid = eligibleReceipts(state).filterNot { it.paid }
    val today = LocalDate.now().toString()
    val overdue = unpaid.count { it.finance.str("dueDate").let { date -> date.isNotEmpty() && date < today } }
    var query by rememberSaveable { mutableStateOf("") }
    val search = (1..6).flatMap { state.optJSONArray(adminKeys.getValue(it)).objects() }
        .filter { query.isNotBlank() && matches(it, query) }.take(20)
    PanelList {
        item { PanelSearch(query, { query = it }, "Buscar cliente, ordem ou funcionário") }
        if (query.isNotBlank()) {
            if (search.isEmpty()) item { EmptyRecord("Nenhum resultado encontrado.") }
            items(search) { record ->
                val isService = record.str("serviceType").isNotBlank() && record.has("items")
                RecordCard(record, if (isService) openService else null)
            }
        } else {
            item {
                val description = when (pending) {
                    0 -> "Acompanhe os atendimentos e os próximos compromissos da equipe."
                    1 -> "Há 1 ordem aguardando sua revisão."
                    else -> "Há $pending ordens aguardando sua revisão."
                }
                PanelIntro("CENTRO OPERACIONAL", "Seu dia, organizado.", description,
                    modifier = Modifier.padding(top = 21.dp))
            }
            item { PrimaryButton("+ Nova ordem de serviço", modifier = Modifier.padding(top = 5.dp, bottom = 20.dp), onClick = register) }
            item {
                PanelMetrics(listOf(
                    PanelMetric("Aguardando revisão", pending.toString(), "Execução enviada pela equipe"),
                    PanelMetric("Em atendimento", services.count { !it.finished && !it.paused }.toString()),
                    PanelMetric("Serviços pausados", services.count { it.paused }.toString()),
                    PanelMetric("A receber", currency(unpaid.sumOf { it.finance.optLong("revenueCents") } / 100.0),
                        if (overdue == 1) "1 acerto vencido" else "$overdue acertos vencidos")
                ), animateValues = true)
            }
            item {
                Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    PanelShortcut("Pó, preços e envios", "Estoque e aceite da equipe", PanelIcon.Money) { select(14) }
                    PanelShortcut("Ordens de serviço", "Acompanhar e revisar", PanelIcon.List) { select(1) }
                    PanelShortcut("Custos e recebimentos", "Conferir resultados", PanelIcon.Money) { select(7) }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    SoftButton("Agenda") { select(9) }
                    SoftButton("Alertas") { select(10) }
                }
            }
        }
    }
}

@Composable
private fun SellerOverview(select: (Int) -> Unit, refresh: Int, register: () -> Unit) {
    val orders = loadTeamSection("/api/seller/services", refresh)?.json?.optJSONArray("services").objects()
    val active = orders.map(::Svc).count { !it.closed && !it.cancelled }
    PanelList {
        item { PanelIntro("ÁREA COMERCIAL", "Suas ordens, em um só lugar.", "Acompanhe seus registros, a agenda e os acertos.") }
        item { PrimaryButton("＋ Registrar serviço", onClick = register) }
        if (orders.isNotEmpty()) item {
            PanelMetrics(listOf(PanelMetric("Em acompanhamento", active.toString()),
                PanelMetric("Finalizadas", orders.count { it.optBoolean("closed") }.toString())))
        }
        item { PanelShortcut("Ordens de serviço", "Consulte a situação de cada ordem", PanelIcon.Wrench) { select(1) } }
        item { PanelShortcut("Próximas manutenções", "Consulte o mês previsto para cada cliente", PanelIcon.Clock) { select(2) } }
        item { PanelShortcut("Meus acertos", "Acompanhe o saldo e as cobranças", PanelIcon.Chart) { select(3) } }
    }
}

@Composable
private fun loadTeamSection(path: String, refresh: Int): Api.ApiResult? {
    val token = Store.token
    var result by remember(path, token) { mutableStateOf<Api.ApiResult?>(null) }
    LaunchedEffect(path, token, refresh) {
        result = if (token.isEmpty()) null else Api.teamSection(token, path)
    }
    return result
}

@Composable
internal fun TeamDataPage(path: String, title: String, field: String, refresh: Int, register: (() -> Unit)? = null,
                          openRecord: ((JSONObject) -> Unit)? = null) {
    var retry by remember { mutableIntStateOf(0) }
    val response = loadTeamSection(path, refresh + retry)
    when {
        response == null -> PanelList {
            item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) { CircularProgressIndicator() } }
        }
        !response.ok -> PanelList {
            item { PanelIntro("", title) }
            item {
                EmptyRecord(response.error.ifEmpty { "Não foi possível carregar esta seção." })
                TextButton(onClick = { retry++ }) { Text("Tentar novamente") }
            }
        }
        else -> RecordsPage(title, response.json.optJSONArray(field).objects(),
            filterStatus = path == "/api/seller/services", register = register, openRecord = openRecord)
    }
}

@Composable
private fun RecordsPage(title: String, records: List<JSONObject>, filterStatus: Boolean = false,
                        register: (() -> Unit)? = null, openRecord: ((JSONObject) -> Unit)? = null) {
    var query by rememberSaveable(title) { mutableStateOf("") }
    var filter by rememberSaveable(title) { mutableIntStateOf(0) }
    val matching = records.filter { matches(it, query) }
    val categories = if (filterStatus) {
        val services = matching.map(::Svc)
        listOf(
            "Todas" to services,
            "Em andamento" to services.filter { !it.finished },
            "Em revisão" to services.filter { it.employeeCompleted && !it.closed && !it.cancelled },
            "Finalizadas" to services.filter { it.closed && !it.cancelled },
            "Canceladas" to services.filter { it.cancelled }
        )
    } else emptyList()
    val shown = categories.getOrNull(filter)?.second?.map(Svc::j) ?: matching
    PanelList {
        item { PanelIntro("", title) }
        if (register != null) item { PrimaryButton("＋ Registrar serviço", onClick = register) }
        item { PanelSearch(query, { query = it }, "Buscar nesta seção") }
        if (filterStatus) item {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                categories.forEachIndexed { index, (label, services) ->
                    WebFilterChip(filter == index, { filter = index }, label = { Text("$label (${services.size})") })
                }
            }
        }
        if (shown.isEmpty()) item { EmptyRecord("Nenhum registro encontrado.") }
        items(shown) { RecordCard(it, openRecord) }
    }
}

@Composable
internal fun PanelList(spacing: Dp = 12.dp, content: LazyListScope.() -> Unit) {
    val team = LocalTeamPanel.current
    val openedAt = remember { SystemClock.uptimeMillis() }
    val appeared = remember { mutableSetOf<Any>() }
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 18.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(spacing)
    ) {
        if (team) content() else PanelEntryScope(this, appeared, openedAt).content()
    }
}

private class PanelEntryScope(
    private val list: LazyListScope,
    private val appeared: MutableSet<Any>,
    private val openedAt: Long
) : LazyListScope by list {
    private var position = 0

    override fun item(key: Any?, contentType: Any?, content: @Composable LazyItemScope.() -> Unit) {
        val index = position++
        list.item(key, contentType) {
            val enter = remember { this@PanelEntryScope.shouldEnter(key ?: index) }
            WebRise(500, 16.dp, minOf(index, 5) * 50, play = enter) { content() }
        }
    }

    override fun items(
        count: Int,
        key: ((Int) -> Any)?,
        contentType: (Int) -> Any?,
        itemContent: @Composable LazyItemScope.(Int) -> Unit
    ) {
        val start = position
        position += count
        list.items(count, key, contentType) { index ->
            val enter = remember {
                this@PanelEntryScope.shouldEnter(key?.invoke(index) ?: (start + index))
            }
            WebRise(450, 16.dp, minOf(index, 5) * 40, play = enter) { itemContent(index) }
        }
    }

    private fun shouldEnter(key: Any): Boolean = appeared.add(key) && SystemClock.uptimeMillis() - openedAt < 900
}

private fun normalized(text: String) = Normalizer.normalize(text, Normalizer.Form.NFD)
    .replace(Regex("\\p{M}+"), "").lowercase(Locale.ROOT)

internal fun matches(item: JSONObject, query: String): Boolean {
    if (query.isBlank()) return true
    val searchable = listOf("clientName", "name", "code", "serviceType", "type", "date", "status", "model")
        .map(item::str) + item.optJSONArray("items").objects().map { it.str("type") + " " + it.str("kg") }
    return searchable.any { normalized(it).contains(normalized(query.trim())) }
}

@Composable
private fun RecordCard(item: JSONObject, openRecord: ((JSONObject) -> Unit)? = null) {
    var open by remember { mutableStateOf(false) }
    val code = item.str("code")
    val title = item.str("clientName").ifBlank { item.str("name") }.ifBlank { code }
        .ifBlank { item.str("periodLabel") }.ifBlank { "Acerto" }
    val status = item.str("status")
    val fields = listOf(
        "Código" to code, "Tipo" to item.str("serviceType").ifBlank { item.str("type") },
        "Data" to item.str("date"), "Situação" to status, "Próxima manutenção" to item.str("nextMaintenanceMonth"),
        "Capacidade" to item.str("kg").let { if (it.isBlank()) "" else "$it kg" },
        "Telefone" to item.str("phone"), "E-mail" to item.str("email"),
        "Valor" to when {
            item.has("amountCents") -> currency(item.optLong("amountCents") / 100.0)
            item.has("price") -> currency(item.optDouble("price", 0.0))
            else -> ""
        }
    ).filter { it.second.isNotBlank() }
    val colors = MaterialTheme.colorScheme
    Surface(onClick = { if (openRecord != null) openRecord(item) else open = true }, shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, colors.outline), color = colors.surface) {
        Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            if (code.isNotBlank() && code != title) Text(code, style = MaterialTheme.typography.labelMedium, color = colors.primary)
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold)
            val secondary = fields.filter { it.first in setOf("Tipo", "Próxima manutenção", "Valor", "Capacidade") }
                .joinToString(" · ") { it.second }
            if (secondary.isNotEmpty()) Text(secondary, color = colors.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            if (status.isNotEmpty()) StatusChip(status)
        }
    }
    if (open) ProtecDialog(
        onDismissRequest = { open = false },
        title = { Text(title) },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                items(fields) { (label, value) ->
                    Column { Text(label, style = MaterialTheme.typography.labelMedium); Text(value) }
                }
                items(item.optJSONArray("items").objects()) { equipment ->
                    Text(listOf(equipment.str("type"), equipment.str("kg").takeIf { it.isNotEmpty() }?.let { "$it kg" }.orEmpty())
                        .filter { it.isNotEmpty() }.joinToString(" · "))
                }
                items(item.optJSONArray("events").objects().ifEmpty { item.optJSONArray("history").objects() }) { event ->
                    val label = event.str("description").ifEmpty { event.str("action") }.ifEmpty { event.str("status") }
                    if (label.isNotEmpty()) Text(label, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = { TextButton(onClick = { open = false }) { Text("Fechar") } },
        scrollBody = false
    )
}

@Composable
internal fun EmptyRecord(message: String) {
    val color = MaterialTheme.colorScheme
    Surface(color = color.surface, shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, color.outline)) {
        Text(message, Modifier.fillMaxWidth().padding(17.dp), color = color.onSurfaceVariant)
    }
}

private fun currency(amount: Double) = NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")).format(amount)
