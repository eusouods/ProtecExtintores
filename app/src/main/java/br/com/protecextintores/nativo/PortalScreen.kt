package br.com.protecextintores.nativo

import android.os.SystemClock
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyItemScope
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.unit.sp
import org.json.JSONObject
import java.text.NumberFormat
import java.text.Normalizer
import java.time.LocalDate
import java.util.Locale

private val adminTabs = listOf(
    PanelTab("Painel", PanelIcon.Grid, "Visão geral"),
    PanelTab("Serviços", PanelIcon.Wrench),
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
    PanelTab("Envios da equipe", PanelIcon.List),
    PanelTab("Configurações", PanelIcon.Gear),
    PanelTab("Acessos de vendedores", PanelIcon.People)
)
private const val ADMIN_SETTINGS_PAGE = 18
private const val ADMIN_SELLER_ACCESS_PAGE = 19
private val adminKeys = mapOf(1 to "services", 2 to "types", 3 to "clients", 4 to "orders", 5 to "products", 6 to "employees")
private val adminDockPages = listOf(0, 1, 7, ADMIN_SETTINGS_PAGE)
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
    val tabs = if (admin) adminDockPages.map { if (it == ADMIN_SETTINGS_PAGE) adminTabs[it].copy(label = "Ajustes") else adminTabs[it] } else sellerTabs
    var page by rememberSaveable(role) { mutableIntStateOf(0) }
    var searchAdmin by rememberSaveable(role) { mutableStateOf(false) }
    var sellerAccessId by rememberSaveable(role) { mutableStateOf<String?>(null) }
    fun openSellerAccess(id: String? = null) {
        sellerAccessId = id
        page = ADMIN_SELLER_ACCESS_PAGE
    }
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
            add(PanelAction("Acessos de vendedores", PanelIcon.People) { openSellerAccess() })
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
    val title = when {
        !admin -> sellerMore.getOrNull(page - 4)?.title
        page == 0 || page == 1 || page == 13 || page == ADMIN_SETTINGS_PAGE || page == ADMIN_SELLER_ACCESS_PAGE -> ""
        else -> adminTabs.getOrNull(page)?.title
    }
    val sections = if (!admin || page == 7) emptyList() else if (maintenanceSections.any { it.first == page }) maintenanceSections
    else adminGroups.firstOrNull { group -> group.sections.any { it.first == page } }?.sections.orEmpty()
    fun select(target: Int) {
        if (target != 0) searchAdmin = false
        page = target
    }
    PanelChrome(tabs, page, ::select, actions,
        refresh = refresh, changeTheme = vm::cycleTheme, team = !admin, title = title,
        dockSection = if (admin) adminDockPages.indexOf(if (page == 9) 1 else page) else page,
        selectDock = { select(if (admin) adminDockPages[it] else it) },
        openAlerts = if (admin) ({ select(10) }) else null, subTabs = sections,
        adminSearch = if (admin) ({ searchAdmin = page != 0 || !searchAdmin; page = 0 }) else null
    ) { active ->
        if (admin) {
            val state = root.optJSONObject("state") ?: JSONObject()
            when (active) {
                0 -> AdminOverview(state, searchAdmin, vm::startRegistration, { openOrder(it.str("id")) }, ::select)
                1 -> RecordsPage(adminTabs[active].title, state.optJSONArray("services").objects(),
                    filterStatus = true, register = vm::startRegistration, openRecord = { openOrder(it.str("id")) }, compactOrders = true)
                2 -> AdminCatalog(vm, state, CatalogArea.Types)
                3 -> AdminDirectory(vm, state, employees = false, openSellerAccess = ::openSellerAccess,
                    openOrder = { openOrder(it) })
                4 -> RecordsPage(adminTabs[active].title, state.optJSONArray("orders").objects())
                5 -> AdminCatalog(vm, state, CatalogArea.Products)
                6 -> AdminDirectory(vm, state, employees = true)
                7 -> AdminReceipts(vm, state, { openOrder(it, finance = true) }) { owner = it }
                8 -> AdminStock(vm, state) { page = 14 }
                9 -> AdminAgenda(state) { openOrder(it) }
                10 -> AdminAlerts(state, { openOrder(it) }) { page = 8 }
                11 -> AdminReports(vm, state)
                12 -> AdminTeamHistory(state) { openOrder(it) }
                13 -> AdminAccess(vm, state)
                14 -> AdminPowder(vm, state)
                15 -> AdminCare(vm)
                16 -> AdminPrices(vm, state)
                17 -> AdminTransfers(vm, state) { openOrder(it) }
                ADMIN_SETTINGS_PAGE -> AdminSettings(vm, state, openTypes = { page = 2 },
                    openPrices = { page = 16 }, openAccess = { page = 13 })
                ADMIN_SELLER_ACCESS_PAGE -> AdminAccess(vm, state, startWithSellers = true,
                    sellerToOpen = sellerAccessId, consumeSeller = { sellerAccessId = null })
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
private fun AdminOverview(state: JSONObject, showSearch: Boolean, register: () -> Unit, openService: (JSONObject) -> Unit, select: (Int) -> Unit) {
    val services = state.optJSONArray("services").objects().map(::Svc).filterNot(Svc::cancelled)
    val review = services.filter { it.employeeCompleted && !it.closed }.sortedByDescending(Svc::date)
    val active = services.filter { !it.finished && !it.paused }.sortedByDescending(Svc::date)
    val paused = services.filter(Svc::paused).sortedByDescending(Svc::date)
    val featured = (review + active + paused).take(3)
    val unpaid = eligibleReceipts(state).filterNot { it.paid }
    val next = unpaid.minByOrNull { it.due ?: LocalDate.MAX }
    var query by rememberSaveable { mutableStateOf("") }
    var expanded by rememberSaveable { mutableStateOf(false) }
    val search = (1..6).flatMap { state.optJSONArray(adminKeys.getValue(it)).objects() }
        .filter { showSearch && query.isNotBlank() && matches(it, query) }.take(20)
    val colors = MaterialTheme.colorScheme
    PanelList(horizontalPadding = 16.dp) {
        if (showSearch) item { PanelSearch(query, { query = it }, "Buscar cliente, ordem ou funcionário", autofocus = true) }
        if (showSearch && query.isNotBlank()) {
            if (search.isEmpty()) item { EmptyRecord("Nenhum resultado encontrado.") }
            items(search) { record ->
                val isService = record.str("serviceType").isNotBlank() && record.has("items")
                RecordCard(record, if (isService) openService else null)
            }
        } else {
            item {
                val description = when (review.size) {
                    0 -> "Acompanhe os atendimentos da equipe."
                    1 -> "1 ordem aguarda sua revisão."
                    else -> "${review.size} ordens aguardam sua revisão."
                }
                PanelIntro("", "Seu dia, organizado.", description)
            }
            item {
                ExpressiveButton(onClick = register) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        PanelGlyph(PanelIcon.Plus, colors.protecOnAction, 16.dp)
                        Text("Nova ordem")
                    }
                }
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OverviewMetric("Aguardando revisão", review.size.toString(), PanelIcon.Review,
                            Modifier.weight(1f).fillMaxHeight()) { select(1) }
                        OverviewMetric("Em atendimento", active.size.toString(), PanelIcon.Wrench,
                            Modifier.weight(1f).fillMaxHeight()) { select(1) }
                    }
                    OverviewMetric("A receber", formatRegistrationMoney(unpaid.sumOf(ReceiptOrder::cents)), PanelIcon.Wallet,
                        Modifier.fillMaxWidth()) { select(7) }
                }
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text("Ordens de serviço", Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        OverviewLink("Ver todas") { select(1) }
                    }
                    if (featured.isEmpty()) EmptyRecord("Nenhuma ordem em andamento.")
                    else Surface(shape = MaterialTheme.shapes.large, color = colors.surface,
                        border = BorderStroke(1.dp, colors.outline)) {
                        Column {
                            featured.forEachIndexed { index, order ->
                                if (index > 0) HorizontalDivider(Modifier.padding(horizontal = 12.dp), color = colors.outline)
                                OverviewOrder(order) { openService(order.j) }
                            }
                        }
                    }
                }
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text("Recebimentos", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Surface(Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large, color = colors.surface,
                        border = BorderStroke(1.dp, colors.outline)) {
                        Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Próxima cobrança", Modifier.weight(1f), color = colors.onSurfaceVariant, fontSize = 13.sp)
                                PanelGlyph(PanelIcon.Clock, colors.primary, 18.dp)
                            }
                            if (next != null) {
                                Text(formatRegistrationMoney(next.cents), fontSize = 24.sp, lineHeight = 29.sp, fontWeight = FontWeight.Bold)
                                Text(next.payer.ifBlank { next.service.client.ifBlank { "Cliente não informado" } },
                                    color = colors.onSurfaceVariant, fontSize = 13.sp)
                            } else Text("Nenhuma cobrança em aberto.", color = colors.onSurfaceVariant, fontSize = 13.sp)
                            OverviewLink("Ver cobranças") { select(7) }
                        }
                    }
                }
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SoftButton(if (expanded) "Ocultar acompanhamento" else "Acompanhamento e atalhos") { expanded = !expanded }
                    if (expanded) {
                        val overdue = unpaid.count { it.due?.isBefore(LocalDate.now()) == true }
                        Text("${paused.size} serviço(s) pausado(s) · $overdue cobrança(s) vencida(s)", color = colors.onSurfaceVariant)
                        PanelShortcut("Pó, preços e envios", "Estoque e aceite da equipe", PanelIcon.Box) { select(14) }
                        PanelShortcut("Agenda", "Próximas manutenções", PanelIcon.Clock) { select(9) }
                        PanelShortcut("Alertas e relatórios", "Acompanhamento da operação", PanelIcon.Chart) { select(10) }
                    }
                }
            }
        }
    }
}

@Composable
private fun OverviewMetric(label: String, value: String, icon: PanelIcon, modifier: Modifier, open: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val (tint, ink) = when (icon) {
        PanelIcon.Review -> colors.tertiaryContainer to colors.onTertiaryContainer
        PanelIcon.Wallet -> colors.protecSuccessContainer to colors.protecSuccess
        else -> colors.primaryContainer to colors.primary
    }
    Surface(onClick = open, modifier = modifier, shape = MaterialTheme.shapes.large,
        color = colors.surface, border = BorderStroke(1.dp, colors.outline)) {
        Row(Modifier.heightIn(min = 61.dp).padding(9.dp), horizontalArrangement = Arrangement.spacedBy(7.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(33.dp).background(tint, RoundedCornerShape(11.dp)), contentAlignment = Alignment.Center) {
                PanelGlyph(icon, ink, 18.dp)
            }
            Column(Modifier.weight(1f)) {
                Text(label, fontSize = 12.sp, lineHeight = 15.sp, color = colors.onSurfaceVariant)
                Text(value, fontSize = 18.sp, lineHeight = 22.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun OverviewOrder(order: Svc, open: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val caution = order.employeeCompleted || order.paused
    Surface(onClick = open, color = colors.surface) {
        Row(Modifier.fillMaxWidth().heightIn(min = 58.dp).padding(horizontal = 12.dp, vertical = 7.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1.6f)) {
                Text(order.client.ifBlank { "Cliente não informado" }, fontSize = 13.sp, lineHeight = 17.sp, fontWeight = FontWeight.SemiBold)
                Text("${order.code.ifBlank { "Ordem" }} · ${order.items.size} extintor(es)", color = colors.onSurfaceVariant, fontSize = 12.sp, lineHeight = 16.sp)
            }
            Box(Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) {
                Surface(shape = RoundedCornerShape(50), color = if (caution) colors.tertiaryContainer else colors.primaryContainer) {
                    Text(if (order.employeeCompleted) "Em revisão" else order.displayStatus, Modifier.padding(horizontal = 7.dp, vertical = 4.dp),
                        color = if (caution) colors.onTertiaryContainer else colors.primary,
                        fontSize = 11.sp, lineHeight = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun OverviewLink(label: String, open: () -> Unit) {
    TextButton(onClick = open, contentPadding = PaddingValues(horizontal = 4.dp)) {
        Text(label, fontSize = 13.sp)
        PanelGlyph(PanelIcon.Chevron, MaterialTheme.colorScheme.primary, 14.dp)
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
            PanelMetrics(listOf(PanelMetric("Em acompanhamento", active.toString(), icon = PanelIcon.Wrench),
                PanelMetric("Finalizadas", orders.count { it.optBoolean("closed") }.toString(), icon = PanelIcon.List)))
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
                ExpressiveTextButton(onClick = { retry++ }) { Text("Tentar novamente") }
            }
        }
        else -> RecordsPage(title, response.json.optJSONArray(field).objects(),
            filterStatus = path == "/api/seller/services", register = register, openRecord = openRecord)
    }
}

@Composable
private fun RecordsPage(title: String, records: List<JSONObject>, filterStatus: Boolean = false,
                        register: (() -> Unit)? = null, openRecord: ((JSONObject) -> Unit)? = null,
                        compactOrders: Boolean = false) {
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
        item { PanelIntro("", title, if (compactOrders) "Acompanhe e revise as ordens de manutenção." else "") }
        if (register != null) item {
            if (compactOrders) ExpressiveButton(onClick = register) { Text("＋ Nova ordem") }
            else PrimaryButton("＋ Registrar serviço", onClick = register)
        }
        item { PanelSearch(query, { query = it }, "Buscar nesta seção") }
        if (filterStatus) item {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                categories.forEachIndexed { index, (label, services) ->
                    WebFilterChip(filter == index, { filter = index }, label = { Text("$label (${services.size})") })
                }
            }
        }
        if (shown.isEmpty()) item { EmptyRecord("Nenhum registro encontrado.") }
        items(shown) { record ->
            if (compactOrders && openRecord != null) {
                val colors = MaterialTheme.colorScheme
                Surface(shape = MaterialTheme.shapes.large, border = BorderStroke(1.dp, colors.outline)) {
                    OverviewOrder(Svc(record)) { openRecord(record) }
                }
            } else RecordCard(record, openRecord)
        }
    }
}

@Composable
internal fun PanelList(spacing: Dp = 12.dp, horizontalPadding: Dp = 12.dp, content: LazyListScope.() -> Unit) {
    val team = LocalTeamPanel.current
    val openedAt = remember { SystemClock.uptimeMillis() }
    val appeared = remember { mutableSetOf<Any>() }
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = horizontalPadding, end = horizontalPadding, top = 18.dp, bottom = 24.dp),
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
        confirmButton = { ExpressiveTextButton(onClick = { open = false }) { Text("Fechar") } },
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
