package br.com.protecextintores.nativo

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.Image
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import kotlinx.coroutines.delay

@Composable
fun AppRoot(vm: AppVm, onRecord: (String) -> Unit, onPick: (String) -> Unit) {
    val screen = vm.screen
    val base = when (screen) {
        is Screen.Registration -> screen.parent
        is Screen.Detail, is Screen.Wizard -> Screen.Home
        else -> screen
    }
    val dialogs = remember { mutableStateListOf<Any>() }
    val workspace = rememberSaveableStateHolder()
    val blur by animateDpAsState(if (dialogs.isNotEmpty()) 8.dp else 0.dp, tween(200, easing = WebEase), label = "Desfoque")
    val message = vm.message
    LaunchedEffect(message) {
        if (message != null) {
            delay(4500)
            vm.message = null
        }
    }
    val feedback: @Composable () -> Unit = {
        MessageBar(vm)
        BusyOverlay(vm.busy, vm.busyText)
    }
    Box(modifier = Modifier.fillMaxSize().systemBarsPadding().imePadding()) {
        CompositionLocalProvider(LocalProtecDialogStack provides dialogs, LocalProtecDialogFeedback provides feedback) {
            Box(Modifier.fillMaxSize().blur(blur)) {
                key(base) {
                    when (base) {
                        Screen.Login -> LoginScreen(vm)
                        Screen.Home -> workspace.SaveableStateProvider("employee:${Store.token.hashCode()}") { HomeScreen(vm) }
                        Screen.Portal -> workspace.SaveableStateProvider("portal:${Store.token.hashCode()}") { PortalScreen(vm) }
                        else -> Unit
                    }
                }
            }
            key(screen) {
                when (screen) {
                    is Screen.Detail -> ProtecSheet(onDismissRequest = vm::back) { DetailScreen(vm, screen.id) }
                    is Screen.Wizard -> ProtecSheet(onDismissRequest = vm::back) { WizardScreen(vm, screen.id, onRecord, onPick) }
                    is Screen.Registration -> ProtecSheet(onDismissRequest = vm::back) { RegistrationScreen(vm) }
                    else -> Unit
                }
            }
        }
        if (dialogs.isEmpty()) feedback()
    }
}

@Composable
private fun MessageBar(vm: AppVm) {
    val text = vm.message
    val distance = with(LocalDensity.current) { 14.dp.roundToPx() }
    Box(modifier = Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.BottomCenter) {
        AnimatedVisibility(
            visible = text != null,
            enter = fadeIn(tween(300, easing = WebEaseOut)) + slideInVertically(tween(300, easing = WebEaseOut)) { distance },
            exit = fadeOut(tween(200, easing = WebEase))
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
    val colors = MaterialTheme.colorScheme
    val fieldColors = OutlinedTextFieldDefaults.colors(
        unfocusedContainerColor = colors.surface, focusedContainerColor = colors.surface,
        unfocusedBorderColor = colors.outlineVariant, focusedBorderColor = colors.primary
    )
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 22.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        WebRise(500, 16.dp) {
            Column(Modifier.widthIn(max = 440.dp).fillMaxWidth()) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Image(painterResource(R.drawable.company_logo), null, Modifier.size(38.dp).clip(RoundedCornerShape(8.dp)))
                    Text("ProtecExtintores", Modifier.weight(1f), fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                    Surface(onClick = vm::cycleTheme, shape = RoundedCornerShape(10.dp), color = colors.surface,
                        border = BorderStroke(1.dp, colors.outlineVariant)) {
                        Box(Modifier.size(42.dp).semantics { contentDescription = "Alternar tema" },
                            contentAlignment = Alignment.Center) { PanelGlyph(PanelIcon.Theme, colors.onSurface) }
                    }
                }
                Spacer(Modifier.height(32.dp))
                Text("PORTAL PROTECEXTINTORES", fontSize = 11.sp, letterSpacing = 1.32.sp,
                    fontWeight = FontWeight.SemiBold, color = colors.secondary)
                Spacer(Modifier.height(13.dp))
                Text("Bem-vindo de volta.", fontSize = 30.sp, lineHeight = 36.sp,
                    letterSpacing = (-1.05).sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(14.dp))
                Text("Entre com o acesso fornecido pelo administrador. Seu painel é identificado automaticamente.",
                    fontSize = 14.sp, lineHeight = 23.sp, color = colors.onSurfaceVariant)
                Spacer(Modifier.height(28.dp))
                Text("Usuário", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = user,
                    onValueChange = { user = it },
                    placeholder = { Text("Seu usuário") },
                    singleLine = true,
                    shape = RoundedCornerShape(10.dp), colors = fieldColors,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(18.dp))
                Text("Senha", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = pass,
                    onValueChange = { pass = it },
                    placeholder = { Text("Sua senha") },
                    singleLine = true,
                    shape = RoundedCornerShape(10.dp), colors = fieldColors,
                    visualTransformation = if (show) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { vm.login(user, pass) }),
                    trailingIcon = {
                        TextButton(onClick = { show = !show }) { Text(if (show) "Ocultar" else "Mostrar") }
                    },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(20.dp))
                PrimaryButton("Entrar", modifier = Modifier.height(52.dp), enabled = !vm.busy) { vm.login(user, pass) }
                Spacer(Modifier.height(19.dp))
                androidx.compose.material3.HorizontalDivider(color = colors.outline)
                Spacer(Modifier.height(15.dp))
                Text("Acesso exclusivo para administradores, funcionários e vendedores autorizados.",
                    fontSize = 11.sp, lineHeight = 19.sp, color = colors.onSurfaceVariant)
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
    val refresh = { vm.refresh(); refreshKey++; Unit }
    PanelChrome(
        teamTabs, vm.employeePage, { vm.employeePage = it }, "FN",
        listOf(
            PanelAction("Nova ordem de serviço", PanelIcon.Plus, vm::startRegistration),
            PanelAction("Meu perfil", PanelIcon.People) { vm.employeePage = 4 }
        ) + panelActions(vm, refresh),
        refresh = refresh, changeTheme = vm::cycleTheme, team = true,
        title = if (vm.employeePage == 4) "Meu perfil" else null
    ) { page ->
        when (page) {
            0 -> EmployeeOverview(vm, p)
            1 -> EmployeeOrders(vm, p)
            2 -> TeamDataPage("/api/employee/next-maintenance", "Próximas manutenções", "services", refreshKey)
            3 -> TeamWallet(refreshKey)
            4 -> AccountProfile(vm)
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
        item { PrimaryButton("＋ Registrar serviço", onClick = vm::startRegistration) }
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
        item { PrimaryButton("＋ Registrar serviço", onClick = vm::startRegistration) }
        item { PanelSearch(query, { query = it }, "Buscar cliente, ordem ou equipamento") }
        item {
            WebSectionTabs(listOf(0 to "Meus serviços", 1 to "Para aceitar", 2 to "Histórico"),
                vm.tab, { vm.tab = it })
        }
        if (shown.isEmpty()) item { EmptyRecord("Nenhuma ordem nesta seção.") }
        itemsIndexed(shown, key = { _, svc -> svc.id }) { index, svc ->
            WebRise(450, 16.dp, minOf(index, 5) * 40) { ServiceCard(svc) { vm.open(svc.id) } }
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
