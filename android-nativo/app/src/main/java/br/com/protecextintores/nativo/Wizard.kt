package br.com.protecextintores.nativo

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import java.io.File

data class PartRow(val part: String, val qty: Int)

data class VideoInfo(
    val file: File,
    val name: String,
    val mime: String,
    val seconds: Double,
    val sha256: String,
    val size: Long
)

data class AgentInfo(val agent: String, val capacityKg: Int, val beforeKg: Int, val balanceKg: Double?, val maxKg: Int)

data class NeedVideo(val index: Int, val part: String, val id: String, val done: Boolean)

enum class WStep(val label: String) {
    PAINT("Pintura"),
    PARTS("Peças"),
    POWDER("Pó"),
    VIDEOS("Vídeos"),
    REVIEW("Conferir")
}

/** O que o funcionário já respondeu no passo a passo de conclusão. */
class WizardState {
    var serviceId by mutableStateOf("")
    var step by mutableIntStateOf(0)
    var goingBack by mutableStateOf(false)
    var paintUse by mutableStateOf<Boolean?>(null)
    var paintQty by mutableIntStateOf(1)
    var partsUse by mutableStateOf<Boolean?>(null)
    val rows = mutableStateListOf<PartRow>()
    var powderUse by mutableStateOf<Boolean?>(null)
    val kg = mutableStateMapOf<String, Int>()
    val videos = mutableStateMapOf<String, VideoInfo>()
    var error by mutableStateOf("")

    fun reset(svc: Svc) {
        serviceId = svc.id
        step = 0
        goingBack = false
        error = ""
        val total = svc.items.size
        paintUse = if (svc.paintingRecorded) svc.paintingQty > 0 else null
        paintQty = maxOf(1, minOf(total, if (svc.paintingQty > 0) svc.paintingQty else 1))
        rows.clear()
        for ((part, qty) in svc.heldParts()) rows.add(PartRow(part, qty))
        partsUse = if (rows.isNotEmpty()) true else null
        powderUse = if (svc.powderRecorded) svc.powderUsage.any { it.optInt("grams", 0) > 0 } else null
        kg.clear()
        for (usage in svc.powderUsage) kg[usage.str("agent")] = usage.optInt("grams", 0) / 1000
        videos.clear()
    }
}

/** Regras do passo a passo: limites por número de extintores, estoque e vídeos obrigatórios. */
class WizardCtx(val svc: Svc, val profile: Profile, val st: WizardState) {
    val total: Int = svc.items.size
    private val held: Map<String, Int> = svc.heldParts()

    /** Estoque disponível desta ordem: o saldo atual mais o que ela já usou. */
    fun stockOf(part: String): Int? {
        val stock = profile.partStock(part) ?: return null
        return stock + (held[part] ?: 0)
    }

    fun maxFor(part: String): Int {
        val stock = stockOf(part)
        return if (stock == null) total else maxOf(0, minOf(total, stock))
    }

    val agents: List<AgentInfo>
        get() = svc.powderCapacityKg().filter { it.value > 0 }.map { (agent, capacity) ->
            val before = (svc.powderUsage.firstOrNull { it.str("agent") == agent }?.optInt("grams", 0) ?: 0) / 1000
            val balance = profile.powderBalance(agent)
            val max = if (balance != null) maxOf(0, minOf(capacity, Math.floor(balance + before).toInt())) else capacity
            AgentInfo(agent, capacity, before, balance, max)
        }

    fun cleanRows(): List<PartRow> =
        if (st.partsUse == true) st.rows.filter { it.part.isNotEmpty() && it.qty > 0 } else emptyList()

    fun steps(): List<WStep> {
        val list = mutableListOf(WStep.PAINT, WStep.PARTS)
        if (agents.isNotEmpty()) list.add(WStep.POWDER)
        if (cleanRows().isNotEmpty()) list.add(WStep.VIDEOS)
        list.add(WStep.REVIEW)
        return list
    }

    fun unusedParts(except: Int): List<String> =
        profile.partCatalog().filter { part -> st.rows.withIndex().none { (i, row) -> i != except && row.part == part } }

    /** Reparte as peças pelos equipamentos sem mudar o que já estava registrado. */
    fun assign(): List<List<String>> {
        val items = svc.items
        val per = List(items.size) { mutableListOf<String>() }
        for (row in cleanRows()) {
            val have = items.indices.filter { i -> items[i].optJSONArray("replacedParts").strings().contains(row.part) }.take(row.qty)
            val extra = items.indices.filter { it !in have }.take(row.qty - have.size)
            for (i in have + extra) per[i].add(row.part)
        }
        return per
    }

    fun needVideos(): List<NeedVideo> {
        val out = ArrayList<NeedVideo>()
        val per = assign()
        for ((i, parts) in per.withIndex()) {
            for (part in parts) {
                val key = "$i|$part"
                val existing = svc.items[i].optJSONObject("replacementMedia")?.optJSONObject(part)?.str("url").orEmpty().isNotEmpty()
                out.add(NeedVideo(i, part, key, st.videos[key] != null || existing))
            }
        }
        return out
    }

    fun validate(step: WStep): String {
        when (step) {
            WStep.PAINT -> {
                if (st.paintUse == null) return "Escolha Sim ou Não."
                if (st.paintUse == true && (st.paintQty < 1 || st.paintQty > total)) return "Informe de 1 a $total extintores."
            }
            WStep.PARTS -> {
                if (st.partsUse == null) return "Escolha Sim ou Não."
                if (st.partsUse == true) {
                    if (st.rows.isEmpty()) return "Adicione pelo menos uma peça ou escolha Não."
                    val seen = HashSet<String>()
                    for (row in st.rows) {
                        if (row.part.isEmpty()) return "Escolha a peça em todas as linhas."
                        if (!seen.add(row.part)) return "A peça ${row.part} foi adicionada duas vezes."
                        val max = maxFor(row.part)
                        if (max < 1) return "${row.part} está sem estoque."
                        if (row.qty < 1 || row.qty > max) return "${row.part}: informe de 1 a $max."
                    }
                }
            }
            WStep.POWDER -> {
                if (st.powderUse == null) return "Escolha Sim ou Não."
                if (st.powderUse == true) {
                    var any = false
                    for (agent in agents) {
                        val n = st.kg[agent.agent] ?: 0
                        if (n < 0 || n > agent.maxKg) return "Informe de 0 a ${agent.maxKg} kg."
                        if (n > 0) any = true
                    }
                    if (!any) return "Informe quantos kg ou escolha Não."
                }
            }
            WStep.VIDEOS -> {
                val missing = needVideos().filter { !it.done }
                if (missing.isNotEmpty()) {
                    return "Falta o vídeo de: " + missing.joinToString(", ") { "${it.part} (equipamento ${it.index + 1})" } + "."
                }
            }
            WStep.REVIEW -> {}
        }
        return ""
    }
}
