package br.com.protecextintores.nativo

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

private fun depth(screen: Screen): Int = when (screen) {
    Screen.Login -> 0
    Screen.Home -> 1
    Screen.Portal -> 1
    is Screen.Detail -> 2
    is Screen.Wizard -> 3
}

@Composable
fun AppRoot(vm: AppVm, onRecord: (String) -> Unit, onPick: (String) -> Unit) {
    BackHandler(enabled = vm.screen !is Screen.Login && vm.screen !is Screen.Home && vm.screen !is Screen.Portal) { vm.back() }
    Box(modifier = Modifier.fillMaxSize().systemBarsPadding().imePadding()) {
        AnimatedContent(
            targetState = vm.screen,
            transitionSpec = {
                val forward = depth(targetState) >= depth(initialState)
                if (forward) {
                    (slideInHorizontally(tween(320)) { it / 5 } + fadeIn(tween(320))) togetherWith
                        (slideOutHorizontally(tween(260)) { -it / 8 } + fadeOut(tween(200)))
                } else {
                    (slideInHorizontally(tween(320)) { -it / 5 } + fadeIn(tween(320))) togetherWith
                        (slideOutHorizontally(tween(260)) { it / 8 } + fadeOut(tween(200)))
                }
            },
            label = "tela"
        ) { screen ->
            when (screen) {
                is Screen.Login -> LoginScreen(vm)
                is Screen.Home -> HomeScreen(vm)
                is Screen.Portal -> PortalScreen(vm)
                is Screen.Detail -> DetailScreen(vm, screen.id)
                is Screen.Wizard -> WizardScreen(vm, screen.id, onRecord, onPick)
            }
        }
        MessageBar(vm)
        BusyOverlay(vm.busy, vm.busyText)
    }
}

@Composable
private fun MessageBar(vm: AppVm) {
    val text = vm.message
    LaunchedEffect(text) {
        if (text != null) {
            delay(4500)
            vm.message = null
        }
    }
    Box(modifier = Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.BottomCenter) {
        AnimatedVisibility(
            visible = text != null,
            enter = fadeIn(tween(250)) + slideInVertically(tween(250)) { it / 2 },
            exit = fadeOut(tween(200))
        ) {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.fillMaxWidth().clickable { vm.message = null }
            ) {
                Text(
                    text ?: "",
                    color = MaterialTheme.colorScheme.surface,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)
                )
            }
        }
    }
}

@Composable
fun LoginScreen(vm: AppVm) {
    var user by rememberSaveable { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    var show by remember { mutableStateOf(false) }
    val visible = remember { MutableTransitionState(false).apply { targetState = true } }
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        AnimatedVisibility(
            visibleState = visible,
            enter = fadeIn(tween(500)) + slideInVertically(tween(500)) { it / 6 }
        ) {
            Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Image(
                    painter = painterResource(R.drawable.company_logo),
                    contentDescription = null,
                    modifier = Modifier.size(84.dp).clip(RoundedCornerShape(22.dp))
                )
                Spacer(Modifier.height(18.dp))
                Text("ProtecExtintores", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text("Acesso da equipe", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(28.dp))
                OutlinedTextField(
                    value = user,
                    onValueChange = { user = it },
                    label = { Text("Usuário") },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = pass,
                    onValueChange = { pass = it },
                    label = { Text("Senha") },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    visualTransformation = if (show) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { vm.login(user, pass) }),
                    trailingIcon = {
                        TextButton(onClick = { show = !show }) { Text(if (show) "Ocultar" else "Mostrar") }
                    },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(20.dp))
                PrimaryButton("Entrar") { vm.login(user, pass) }
            }
        }
    }
}

@Composable
fun HomeScreen(vm: AppVm) {
    val p = vm.profile
    if (p == null) {
        LaunchedEffect(Unit) { vm.logout() }
        return
    }
    var refreshKey by remember { androidx.compose.runtime.mutableIntStateOf(0) }
    PanelChrome(
        teamTabs, vm.employeePage, { vm.employeePage = it }, "FN",
        panelActions(vm) { vm.refresh(); refreshKey++ }
    ) { page ->
        when (page) {
            0 -> EmployeeOverview(vm, p)
            1 -> EmployeeOrders(vm, p)
            2 -> TeamDataPage("/api/employee/next-maintenance", "Próximas manutenções", "services", refreshKey)
            3 -> TeamDataPage("/api/team/billing", "Meus acertos", "bills", refreshKey)
        }
    }
}

@Composable
private fun EmployeeOverview(vm: AppVm, profile: Profile) {
    val current = profile.mine.firstOrNull { !it.finished && !it.paused }
    PanelList {
        item {
            PanelIntro("ÁREA TÉCNICA", "Seu trabalho, organizado.",
                "Acompanhe os atendimentos da equipe e atualize cada etapa.")
        }
        item {
            PanelMetrics(listOf(
                PanelMetric("Em atendimento", profile.mine.count { !it.finished && !it.paused }.toString()),
                PanelMetric("Para aceitar", profile.available.size.toString()),
                PanelMetric("Pausados", profile.mine.count { it.paused }.toString()),
                PanelMetric("No histórico", profile.mine.count { it.finished }.toString())
            ))
        }
        if (current != null) item {
            PanelShortcut("Continuar atendimento", current.code + " · " + current.client, PanelIcon.Wrench) { vm.open(current.id) }
        }
        item {
            PanelShortcut("Serviços para aceitar", "Veja o que está disponível para a equipe", PanelIcon.List) {
                vm.tab = 1
                vm.employeePage = 1
            }
        }
        item {
            PanelShortcut("Próximas manutenções", "Consulte as previsões registradas", PanelIcon.Clock) { vm.employeePage = 2 }
        }
        item {
            PanelShortcut("Meus acertos", "Consulte o saldo e as cobranças", PanelIcon.Chart) { vm.employeePage = 3 }
        }
    }
}

@Composable
private fun EmployeeOrders(vm: AppVm, profile: Profile) {
    var query by rememberSaveable { mutableStateOf("") }
    val records = when (vm.tab) {
        1 -> profile.available
        2 -> profile.mine.filter { it.finished }
        else -> profile.mine.filterNot { it.finished }
    }
    val shown = records.filter { matches(it.j, query) }
    PanelList {
        item { PanelIntro("", "Ordens de serviço") }
        item { PanelSearch(query, { query = it }, "Buscar cliente, ordem ou equipamento") }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                listOf("Meus serviços", "Para aceitar", "Histórico").forEachIndexed { index, text ->
                    FilterChip(vm.tab == index, { vm.tab = index }, label = { Text(text) })
                }
            }
        }
        if (shown.isEmpty()) item { EmptyRecord("Nenhuma ordem nesta seção.") }
        itemsIndexed(shown, key = { _, svc -> svc.id }) { index, svc ->
            val visible = remember { MutableTransitionState(false).apply { targetState = true } }
            AnimatedVisibility(
                visibleState = visible,
                enter = fadeIn(tween(240, delayMillis = minOf(index, 5) * 30)) +
                    slideInVertically(tween(280, delayMillis = minOf(index, 5) * 30)) { it / 7 }
            ) { ServiceCard(svc) { vm.open(svc.id) } }
        }
    }
}

@Composable
private fun ServiceCard(svc: Svc, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(svc.code, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(svc.client.ifEmpty { "Cliente" }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(equipmentSummary(svc), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.size(10.dp))
            StatusChip(svc.displayStatus)
        }
    }
}

fun equipmentSummary(svc: Svc): String {
    val groups = LinkedHashMap<String, Int>()
    for (item in svc.items) {
        val kg = item.str("kg")
        val label = item.str("type") + if (kg.isNotEmpty()) " · $kg kg" else ""
        groups[label] = (groups[label] ?: 0) + 1
    }
    return groups.entries.joinToString(" • ") { "${it.key} × ${it.value}" }.ifEmpty { "Sem equipamentos" }
}
