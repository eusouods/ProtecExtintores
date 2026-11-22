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
    is Screen.Detail -> 2
    is Screen.Wizard -> 3
}

@Composable
fun AppRoot(vm: AppVm, onRecord: (String) -> Unit, onPick: (String) -> Unit) {
    BackHandler(enabled = vm.screen !is Screen.Login && vm.screen !is Screen.Home) { vm.back() }
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
    var pass by rememberSaveable { mutableStateOf("") }
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
                Text("Painel do funcionário", color = MaterialTheme.colorScheme.onSurfaceVariant)
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
    val mine = p.mine
    val available = p.available
    val list = if (vm.tab == 0) mine else available
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = 8.dp, top = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Serviços", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text(
                    p.username.ifEmpty { p.company },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            IconButton(onClick = { vm.refresh() }) { Icon(Icons.Filled.Refresh, contentDescription = "Atualizar") }
            TextButton(onClick = { vm.cycleTheme() }) {
                Text(
                    when (vm.themeMode) {
                        "light" -> "Claro"
                        "dark" -> "Escuro"
                        else -> "Auto"
                    }
                )
            }
            TextButton(onClick = { vm.logout() }) { Text("Sair") }
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            TabPill("Meus serviços (${mine.size})", vm.tab == 0, Modifier.weight(1f)) { vm.tab = 0 }
            TabPill("Para aceitar (${available.size})", vm.tab == 1, Modifier.weight(1f)) { vm.tab = 1 }
        }
        if (list.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.TopCenter) {
                Text(
                    if (vm.tab == 0) "Você não tem serviços no momento." else "Nenhum serviço disponível para aceitar.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                itemsIndexed(list, key = { _, svc -> svc.id }) { index, svc ->
                    val visible = remember { MutableTransitionState(false).apply { targetState = true } }
                    val delayMs = minOf(index, 8) * 45
                    AnimatedVisibility(
                        visibleState = visible,
                        enter = fadeIn(tween(320, delayMillis = delayMs)) + slideInVertically(tween(320, delayMillis = delayMs)) { it / 6 }
                    ) {
                        ServiceCard(svc) { vm.open(svc.id) }
                    }
                }
            }
        }
    }
}

@Composable
private fun TabPill(text: String, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val background = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface
    val foreground = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(999.dp),
        color = background,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (selected) background else MaterialTheme.colorScheme.outline),
        modifier = modifier
    ) {
        Box(modifier = Modifier.padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
            Text(text, color = foreground, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.labelLarge)
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
