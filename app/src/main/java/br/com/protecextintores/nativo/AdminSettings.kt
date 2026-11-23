package br.com.protecextintores.nativo

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException

private enum class SettingsSection(val title: String, val description: String, val icon: PanelIcon) {
    Company("Empresa e identidade", "Nome público e logotipo", PanelIcon.Gear),
    Availability("Disponibilidade do site", "Loja e solicitações de manutenção", PanelIcon.Cart),
    Stages("Etapas do serviço", "Sequência exibida no acompanhamento", PanelIcon.List),
    StaffFlow("Avanço pelo funcionário", "Etapas permitidas e regras de conclusão", PanelIcon.Wrench),
    Complements("Serviços complementares", "Opções e tipos disponíveis no cadastro", PanelIcon.Plus),
    Pix("Pagamento via Pix", "Chave Pix e cidade do recebedor", PanelIcon.Wallet),
    PixProvider("Verificação automática de Pix", "Provedor e confirmação por webhook", PanelIcon.Wallet),
    Access("Privacidade e acesso", "Usuário e senha do administrador", PanelIcon.Shield)
}

private data class SettingsEdit(val section: SettingsSection, val state: JSONObject)
private val unavailableStages = setOf("Concluído", "Solicitado", "Aguardando peça")

@Composable
internal fun AdminSettings(vm: AppVm, state: JSONObject, openTypes: () -> Unit, openPrices: () -> Unit, openAccess: () -> Unit) {
    var editing by remember { mutableStateOf<SettingsEdit?>(null) }
    val close = { editing = null }
    PanelList {
        item { PanelIntro("", "Configurações", "Gerencie as preferências da empresa e do painel.") }
        for (section in SettingsSection.entries) item(key = section.name) {
            PanelShortcut(section.title, section.description, section.icon) { editing = SettingsEdit(section, state) }
        }
        item { PanelShortcut("Tipos de extintor", "Capacidades e preços de manutenção", PanelIcon.Flame, openTypes) }
        item { PanelShortcut("Preços sugeridos", "Extintores, peças e serviços complementares", PanelIcon.Chart, openPrices) }
        item { PanelShortcut("Acessos da equipe", "Funcionários e vendedores", PanelIcon.People, openAccess) }
    }
    val edit = editing ?: return
    val settings = edit.state.optJSONObject("settings") ?: JSONObject()
    val save: (JSONObject) -> Unit = { fields -> vm.saveAdminSettings(edit.state, fields, close) }
    when (edit.section) {
        SettingsSection.Company -> CompanySettings(settings, vm.busy, close, save)
        SettingsSection.StaffFlow -> StaffFlowSettings(settings, vm.busy, close, save)
        SettingsSection.Complements -> AdminComplementSettings(settings, vm.busy, close, save)
        SettingsSection.PixProvider -> AdminPixProvider(vm, close)
        SettingsSection.Availability -> {
            val fields = remember {
                listOf(CatalogField("shopEnabled", "Loja ativa", toggle = true), CatalogField("servicesEnabled", "Manutenções ativas", toggle = true))
            }
            val initial = remember(edit) { JSONObject().put("shopEnabled", settings.optBoolean("shopEnabled", true))
                .put("servicesEnabled", settings.optBoolean("servicesEnabled", true)) }
            NativeFieldsDialog(edit.section.title, fields, initial, vm.busy, close) { values ->
                save(values)
                null
            }
        }
        SettingsSection.Stages -> {
            val fields = remember { listOf(CatalogField("stages", "Uma etapa por linha", maxLength = 6000, multiline = true)) }
            val initial = remember(edit) { JSONObject().put("stages", settings.optJSONArray("stages").strings().joinToString("\n")) }
            NativeFieldsDialog(edit.section.title, fields, initial, vm.busy, close) { values ->
                val stages = values.str("stages").lineSequence().map(String::trim).filter(String::isNotEmpty).distinct().toList()
                when {
                    stages.size < 2 -> "Informe pelo menos duas etapas diferentes."
                    stages.any { it.length > 60 } -> "Use até 60 caracteres por etapa."
                    stages.none { it !in unavailableStages } -> "Inclua uma etapa que o funcionário possa usar."
                    "Aguardando peça" in stages -> "A etapa Aguardando peça foi substituída por Em manutenção."
                    else -> {
                        save(JSONObject().put("stages", JSONArray(stages)))
                        null
                    }
                }
            }
        }
        SettingsSection.Pix -> {
            val fields = remember {
                listOf(CatalogField("pixKey", "Chave Pix da empresa", maxLength = 100), CatalogField("pixCity", "Cidade do recebedor", maxLength = 15))
            }
            NativeFieldsDialog(edit.section.title, fields, settings, vm.busy, close) { values ->
                save(values)
                null
            }
        }
        SettingsSection.Access -> {
            val fields = remember {
                listOf(CatalogField("username", "Usuário do painel", maxLength = 60),
                    CatalogField("password", "Nova senha", maxLength = 128, secret = true),
                    CatalogField("repeatPassword", "Confirme a nova senha", maxLength = 128, secret = true))
            }
            val initial = remember(edit) { JSONObject().put("username", settings.str("username")) }
            NativeFieldsDialog(edit.section.title, fields, initial, vm.busy, close) { values ->
                val password = values.str("password")
                when {
                    values.str("username").length < 3 || password.length < 5 -> "Use pelo menos 3 caracteres no usuário e 5 na senha."
                    password != values.str("repeatPassword") -> "As senhas não conferem."
                    else -> {
                        val id = JSONObject().put("username", values.str("username")).put("password", password)
                        vm.adminAction("/api/admin/credentials", id, "Acesso atualizado.") { vm.logout("Acesso atualizado. Entre novamente.") }
                        null
                    }
                }
            }
        }
    }
}

@Composable
private fun StaffFlowSettings(settings: JSONObject, busy: Boolean, close: () -> Unit, save: (JSONObject) -> Unit) {
    val flow = remember(settings) { stageFlow(settings) }
    val stages = remember(settings) { settings.optJSONArray("stages").strings().filter { it !in unavailableStages }.distinct() }
    var enabled by remember(flow) { mutableStateOf(flow.stages.toSet()) }
    var completeAt by remember(flow) { mutableStateOf(flow.completeAt) }
    var requireStage by remember(flow) { mutableStateOf(flow.requireCompleteStage) }
    var allowSkip by remember(flow) { mutableStateOf(flow.allowSkip) }
    var chooseStage by remember { mutableStateOf(false) }
    val selected = stages.filter { it in enabled }
    ProtecDialog(onDismissRequest = { if (!busy) close() }, title = { Text("Avanço pelo funcionário") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Etapas que o funcionário pode usar")
                if (stages.isEmpty()) Text("Cadastre as etapas em Etapas do serviço.")
                for (stage in stages) SettingsCheckbox(stage, stage in enabled, !busy) { checked ->
                    enabled = if (checked) enabled + stage else enabled - stage
                    if (completeAt !in enabled) completeAt = stages.lastOrNull { it in enabled }.orEmpty()
                }
                Text("Pode concluir a execução a partir de")
                SoftButton(completeAt.ifBlank { "Escolher etapa de conclusão" }, enabled = !busy && selected.isNotEmpty()) {
                    chooseStage = true
                }
                SettingsCheckbox("Exigir chegar à etapa selecionada antes de concluir", requireStage, !busy) { requireStage = it }
                SettingsCheckbox("Permitir pular etapas", allowSkip, !busy) { allowSkip = it }
            }
        }, confirmButton = {
            ExpressiveButton(enabled = !busy && completeAt in selected, onClick = {
                val value = JSONObject().put("employeeStages", JSONArray(selected)).put("completeAt", completeAt)
                    .put("requireCompleteStage", requireStage).put("allowSkip", allowSkip)
                save(JSONObject().put("stageFlow", value))
            }) { Text("Salvar") }
        }, dismissButton = { ExpressiveTextButton(onClick = { if (!busy) close() }) { Text("Cancelar") } })
    if (chooseStage) ProtecOptions("Pode concluir a partir de", selected.map { SheetOption(it) }, completeAt,
        close = { chooseStage = false }, choose = { completeAt = it })
}

@Composable
private fun SettingsCheckbox(label: String, checked: Boolean, enabled: Boolean, change: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).toggleable(checked, enabled = enabled, role = Role.Checkbox, onValueChange = change),
        verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked, onCheckedChange = null, enabled = enabled)
        Text(label, Modifier.padding(start = 10.dp))
    }
}

@Composable
private fun CompanySettings(settings: JSONObject, busy: Boolean, close: () -> Unit, save: (JSONObject) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var name by remember(settings) { mutableStateOf(settings.str("company")) }
    var image by remember(settings) { mutableStateOf<Pair<Bitmap, String>?>(null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            error = ""
            loading = true
            scope.launch {
                try {
                    image = readCompanyLogo(context, uri)
                } catch (_: IOException) {
                    error = "Não foi possível abrir a imagem. Selecione um arquivo de imagem válido."
                } catch (_: SecurityException) {
                    error = "O Android não permitiu acessar a imagem selecionada."
                } finally {
                    loading = false
                }
            }
        }
    }
    ProtecDialog(onDismissRequest = { if (!busy && !loading) close() }, title = { Text("Empresa e identidade") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(name, { if (it.length <= 160) name = it }, Modifier.fillMaxWidth(), singleLine = true,
                    label = { Text("Nome da empresa") }, enabled = !busy && !loading)
                val logo = image
                if (logo != null) Image(logo.first.asImageBitmap(), "Prévia do novo logotipo", Modifier.heightIn(max = 100.dp))
                else if (settings.str("logo").isNotBlank()) Text("Logotipo cadastrado no site.")
                SoftButton(if (loading) "Preparando imagem…" else "Selecionar logotipo", enabled = !busy && !loading) {
                    picker.launch("image/*")
                }
                if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
            }
        }, confirmButton = {
            ExpressiveButton(enabled = !busy && !loading && name.isNotBlank(), onClick = {
                val changes = JSONObject().put("company", name.trim())
                // The site retains a custom logo when this brand migration has already been applied.
                image?.let { changes.put("logo", it.second).put("logoIdentity", "official-logo-19") }
                save(changes)
            }) { Text("Salvar identidade") }
        }, dismissButton = { ExpressiveTextButton(onClick = { if (!busy && !loading) close() }) { Text("Cancelar") } })
}

private suspend fun readCompanyLogo(context: Context, uri: Uri): Pair<Bitmap, String> = withContext(Dispatchers.IO) {
    val resolver = context.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
    val longest = maxOf(bounds.outHeight, bounds.outWidth)
    if (bounds.outHeight <= 0 || bounds.outWidth <= 0) throw IOException("Imagem inválida")
    var sample = 1
    while (longest / sample > 384) sample *= 2
    val options = BitmapFactory.Options().apply { inSampleSize = sample }
    val bitmap = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
        ?: throw IOException("Imagem inválida")
    val output = ByteArrayOutputStream()
    if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) throw IOException("Falha ao converter imagem")
    bitmap to ("data:image/png;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP))
}
