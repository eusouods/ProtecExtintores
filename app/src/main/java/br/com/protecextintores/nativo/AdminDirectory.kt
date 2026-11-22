package br.com.protecextintores.nativo

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.json.JSONObject

private data class ContactField(val key: String, val label: String, val limit: Int)
private data class ContactEdit(val original: JSONObject?)

@Composable
internal fun AdminDirectory(vm: AppVm, state: JSONObject, employees: Boolean) {
    var group by rememberSaveable(employees) { mutableStateOf(if (employees) "employees" else "clients") }
    var query by rememberSaveable(group) { mutableStateOf("") }
    var editing by remember { mutableStateOf<ContactEdit?>(null) }
    val title = when (group) {
        "clients" -> "Clientes"
        "sellers" -> "Vendedores"
        else -> "Funcionários"
    }
    val items = state.optJSONArray(group).objects().filter { matches(it, query) }
    PanelList {
        item { PanelIntro("", if (employees) "Funcionários" else "Clientes e vendedores") }
        if (!employees) item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                WebFilterChip(group == "clients", { group = "clients" }, label = { Text("Clientes") })
                WebFilterChip(group == "sellers", { group = "sellers" }, label = { Text("Vendedores") })
            }
        }
        item { PrimaryButton("＋ Novo cadastro", enabled = !vm.busy) { editing = ContactEdit(null) } }
        item { PanelSearch(query, { query = it }, "Buscar em ${title.lowercase()}") }
        if (items.isEmpty()) item { EmptyRecord("Nenhum cadastro nesta lista.") }
        items(items) { contact ->
            CardBox {
                Text(contact.str("name"), fontWeight = FontWeight.ExtraBold)
                listOf("role", "phone", "email", "document").map(contact::str).filter(String::isNotBlank).forEach { Text(it) }
                ExpressiveTextButton(onClick = { editing = ContactEdit(contact) }, enabled = !vm.busy) { Text("Editar cadastro") }
            }
        }
    }
    editing?.let { current ->
        val common = listOf(ContactField("name", "Nome", 100), ContactField("phone", "Telefone", 30), ContactField("email", "E-mail", 254))
        val fields = common + when (group) {
            "clients" -> listOf(ContactField("document", "CPF/CNPJ", 20), ContactField("address", "Endereço", 200), ContactField("notes", "Observações", 3000))
            "employees" -> listOf(ContactField("role", "Função", 100))
            else -> emptyList()
        }
        var values by remember(current) { mutableStateOf(fields.associate { field -> field.key to current.original?.str(field.key).orEmpty() }) }
        var error by remember(current) { mutableStateOf("") }
        ProtecDialog(onDismissRequest = { if (!vm.busy) editing = null },
            title = { Text(if (current.original == null) "Novo cadastro" else "Editar cadastro") },
            text = {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    for (field in fields) OutlinedTextField(values[field.key].orEmpty(),
                        { if (it.length <= field.limit) values = values + (field.key to it) },
                        label = { Text(field.label) }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                    if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
                }
            },
            confirmButton = {
                ExpressiveTextButton(enabled = !vm.busy, onClick = {
                    val name = values["name"].orEmpty().trim()
                    val phone = values["phone"].orEmpty().trim()
                    val email = values["email"].orEmpty().trim()
                    error = when {
                        name.length < 2 -> "Informe o nome."
                        phone.isNotEmpty() && !phone.matches(Regex("""\+?[\d\s().-]{8,30}""")) -> "Confira o telefone."
                        email.isNotEmpty() && !email.matches(Regex("""[^\s@]+@[^\s@]+\.[^\s@]+""")) -> "Confira o e-mail."
                        else -> ""
                    }
                    if (error.isEmpty()) vm.saveContact(group, current.original, JSONObject(values.mapValues { it.value.trim() })) {
                        editing = null
                    }
                }) { Text("Salvar") }
            },
            dismissButton = { ExpressiveTextButton(onClick = { if (!vm.busy) editing = null }) { Text("Cancelar") } })
    }
}
