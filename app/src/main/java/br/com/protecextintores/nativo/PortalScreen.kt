package br.com.protecextintores.nativo

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject

private data class PortalTab(val label: String, val mark: String)

@Composable
fun PortalScreen(vm: AppVm) {
    val role = vm.portalRole
    val tabs = if (role == "admin") listOf(
        PortalTab("Resumo", "⌂"), PortalTab("Serviços", "⚒"), PortalTab("Pedidos", "▣"), PortalTab("Produtos", "◇")
    ) else listOf(PortalTab("Resumo", "⌂"), PortalTab("Catálogo", "◇"), PortalTab("Pedidos", "▣"))
    var selected by remember(role) { mutableIntStateOf(0) }
    var optionsOpen by remember { androidx.compose.runtime.mutableStateOf(false) }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(if (role == "admin") "Painel administrativo" else "Painel do vendedor", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(vm.portalState?.str("username").ifNullOrBlank("ProtecExtintores"), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            TextButton(onClick = { optionsOpen = true }) { Text("•••") }
            DropdownMenu(expanded = optionsOpen, onDismissRequest = { optionsOpen = false }, shape = RoundedCornerShape(18.dp), containerColor = MaterialTheme.colorScheme.surface.copy(alpha = .96f)) {
                DropdownMenuItem(text = { Text("Atualizar painel") }, onClick = { optionsOpen = false; vm.refreshPortal() })
                DropdownMenuItem(text = { Text("Alternar tema") }, onClick = { optionsOpen = false; vm.cycleTheme() })
                DropdownMenuItem(text = { Text("Sair da conta") }, onClick = { optionsOpen = false; vm.logout() })
            }
        }
        AnimatedContent(targetState = selected, modifier = Modifier.weight(1f), transitionSpec = {
            (slideInHorizontally(tween(260)) { if (targetState > initialState) it / 6 else -it / 6 } + fadeIn(tween(220))) togetherWith
                (slideOutHorizontally(tween(180)) { if (targetState > initialState) -it / 8 else it / 8 } + fadeOut(tween(160)))
        }, label = "portal") { page -> PortalPage(role, page, vm.portalState) }
        NavigationBar(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = .94f), tonalElevation = 0.dp) {
            tabs.forEachIndexed { index, tab ->
                NavigationBarItem(selected = selected == index, onClick = { selected = index }, icon = { Text(tab.mark) }, label = { AnimatedVisibility(selected == index) { Text(tab.label) } })
            }
        }
    }
}

@Composable
private fun PortalPage(role: String, page: Int, root: JSONObject?) {
    val state = root ?: JSONObject()
    val title = if (role == "admin") listOf("Visão geral", "Serviços", "Pedidos", "Produtos")[page] else listOf("Visão geral", "Catálogo", "Meus pedidos")[page]
    val entries = when {
        role == "admin" && page == 1 -> state.obj("state").array("services")
        role == "admin" && page == 2 -> state.obj("state").array("orders")
        role == "admin" && page == 3 -> state.obj("state").array("products")
        role == "seller" && page == 1 -> state.array("products")
        role == "seller" && page == 2 -> state.array("orders")
        else -> emptyList()
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Spacer(Modifier.height(6.dp)); Text(title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold); Text(if (role == "admin") "Acompanhamento da operação em tempo real." else "Vendas, catálogo e pedidos da sua carteira.", color = MaterialTheme.colorScheme.onSurfaceVariant); Spacer(Modifier.height(6.dp)) }
        if (page == 0) item { Overview(role, state) }
        if (page != 0 && entries.isEmpty()) item { Text("Nenhum registro disponível.", modifier = Modifier.padding(vertical = 32.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
        items(entries, key = { it.str("id").ifEmpty { it.str("code") }.ifEmpty { it.toString().hashCode().toString() } }) { PortalItem(it) }
        item { Spacer(Modifier.height(8.dp)) }
    }
}

@Composable
private fun Overview(role: String, root: JSONObject) {
    val state = if (role == "admin") root.obj("state") else root
    Card(shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .82f))) {
        Column(Modifier.fillMaxWidth().padding(20.dp)) {
            Text(if (role == "admin") "A operação hoje" else "Seu desempenho", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(14.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Metric("Serviços", state.array("services").size)
            Metric("Pedidos", state.array("orders").size)
            Metric("Produtos", state.array("products").size)
        }
    }
}
}

@Composable private fun Metric(label: String, value: Int) { Column { Text(value.toString(), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold); Text(label, style = MaterialTheme.typography.labelSmall) } }

@Composable
private fun PortalItem(item: JSONObject) {
    val name = item.str("clientName").ifEmpty { item.str("name") }.ifEmpty { item.str("code") }.ifEmpty { "Registro" }
    val secondary = item.str("code").ifEmpty { item.str("type") }.ifEmpty { item.str("serviceType") }
    Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = .92f))) {
        Column(Modifier.fillMaxWidth().padding(18.dp)) {
            Text(name, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (secondary.isNotEmpty()) Text(secondary, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            item.str("status").takeIf { it.isNotEmpty() }?.let { Text(it, modifier = Modifier.padding(top = 6.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary) }
        }
    }
}

private fun String?.ifNullOrBlank(fallback: String) = if (this.isNullOrBlank()) fallback else this
private fun JSONObject.obj(key: String) = optJSONObject(key) ?: JSONObject()
private fun JSONObject.array(key: String): List<JSONObject> { val source = optJSONArray(key) ?: JSONArray(); return List(source.length()) { source.optJSONObject(it) ?: JSONObject() } }
