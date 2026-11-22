package br.com.protecextintores.nativo

import org.json.JSONObject

val PART_NAMES = listOf("Válvula M30", "Válvula de CO₂", "Sifão", "Manômetro", "Mangueira", "Difusor", "Outro")

private val RE_ABC = Regex("p[oó].*ABC", RegexOption.IGNORE_CASE)
private val RE_BC = Regex("p[oó].*BC", RegexOption.IGNORE_CASE)

fun powderAgent(type: String): String? = when {
    RE_ABC.containsMatchIn(type) -> "ABC"
    RE_BC.containsMatchIn(type) -> "BC"
    else -> null
}

/** Regras de avanço de etapa definidas pelo administrador nas Configurações. */
data class Flow(
    val stages: List<String>,
    val completeAt: String,
    val requireCompleteStage: Boolean,
    val allowSkip: Boolean
)

fun stageFlow(settings: JSONObject?): Flow {
    val hidden = setOf("Concluído", "Solicitado", "Aguardando peça")
    val all = settings?.optJSONArray("stages").strings().filter { it !in hidden }
    val raw = settings?.optJSONObject("stageFlow")
    val defaults = listOf("Recebido", "Em manutenção", "Pintando", "Inspeção final")
    val chosenRaw = if (raw != null && raw.optJSONArray("employeeStages") != null) raw.optJSONArray("employeeStages").strings() else defaults
    val chosen = chosenRaw.filter { it in all }
    val allowed = if (chosen.isEmpty()) all else chosen
    val stages = all.filter { it in allowed }
    val completeRaw = raw?.str("completeAt") ?: ""
    val completeAt = when {
        completeRaw in stages -> completeRaw
        "Inspeção final" in stages -> "Inspeção final"
        else -> stages.lastOrNull() ?: ""
    }
    return Flow(
        stages = stages,
        completeAt = completeAt,
        requireCompleteStage = raw?.optBoolean("requireCompleteStage", true) ?: true,
        allowSkip = raw?.optBoolean("allowSkip", true) ?: true
    )
}

/** Um serviço (ordem) como o servidor envia ao funcionário. */
class Svc(val j: JSONObject) {
    val id: String get() = j.str("id")
    val code: String get() = j.str("code")
    val client: String get() = j.str("clientName")
    val type: String get() = j.str("serviceType")
    val date: String get() = j.str("date")
    val status: String get() = j.str("status")
    val employeeId: String get() = j.str("employeeId")
    val employeeName: String get() = j.str("employeeName")
    val version: String get() = j.str("syncVersion")
    val items: List<JSONObject> get() = j.optJSONArray("items").objects()
    val closed: Boolean get() = j.optBoolean("closed", false)
    val cancelled: Boolean get() = j.str("cancelledAt").isNotEmpty() || status == "Cancelado"
    val employeeCompleted: Boolean get() = j.str("employeeCompletedAt").isNotEmpty()
    val paused: Boolean get() = j.str("pausedAt").isNotEmpty() && !closed && !employeeCompleted && !cancelled
    val pauseReason: String get() = j.str("pauseReason")
    val paintingQty: Int get() = j.optInt("paintingQuantity", 0)
    val paintingRecorded: Boolean get() = j.str("paintingRecordedAt").isNotEmpty()
    val powderRecorded: Boolean get() = j.str("powderRecordedAt").isNotEmpty()
    val powderUsage: List<JSONObject> get() = j.optJSONArray("powderUsage").objects()
    val finished: Boolean get() = closed || employeeCompleted || cancelled

    /** Fase atual de 1 a 5, como no site: Registrado, Aguardando aceite, Em execução, Revisão, Finalizado. */
    val phase: Int
        get() = when {
            cancelled -> -1
            closed -> 4
            employeeCompleted -> 3
            employeeId.isNotEmpty() -> 2
            else -> 1
        }

    val displayStatus: String
        get() = when {
            cancelled -> "Cancelado"
            closed -> "Finalizado"
            employeeCompleted -> "Aguardando revisão"
            paused -> "Pausado"
            employeeId.isNotEmpty() -> status.ifEmpty { "Em execução" }
            else -> "Aguardando aceite"
        }

    /** Capacidade de pó químico em kg por tipo (ABC e BC), somando os extintores da ordem. */
    fun powderCapacityKg(): Map<String, Int> {
        val grams = mutableMapOf("ABC" to 0L, "BC" to 0L)
        for (item in items) {
            val agent = powderAgent(item.str("type"))
            if (agent != null) {
                val kg = item.str("kg").toDoubleOrNull() ?: 0.0
                grams[agent] = (grams[agent] ?: 0L) + Math.round(kg * 1000)
            }
        }
        return grams.mapValues { (it.value / 1000).toInt() }
    }

    /** Quantas unidades de cada peça já estão registradas na ordem. */
    fun heldParts(): Map<String, Int> {
        val out = LinkedHashMap<String, Int>()
        for (item in items) {
            for (part in item.optJSONArray("replacedParts").strings()) out[part] = (out[part] ?: 0) + 1
        }
        return out
    }

    fun hasReplacedParts(): Boolean = items.any { it.optJSONArray("replacedParts").strings().isNotEmpty() }
}

/** Tudo o que o servidor entrega ao entrar: serviços, regras e estoque. */
class Profile(val j: JSONObject) {
    val accountKey: String get() = j.str("accountKey")
    val dataEpoch: String get() = j.str("dataEpoch").ifEmpty { "initial" }
    val actorId: String get() = j.optJSONObject("actor")?.str("id") ?: ""
    val username: String get() = j.str("username")
    val settings: JSONObject? get() = j.optJSONObject("settings")
    val company: String get() = settings?.str("company")?.ifEmpty { null } ?: "ProtecExtintores"
    val flow: Flow get() = stageFlow(settings)
    val mine: List<Svc> get() = j.optJSONArray("services").objects().map { Svc(it) }
    val available: List<Svc> get() = j.optJSONArray("available").objects().map { Svc(it) }

    fun find(id: String): Svc? = (mine + available).firstOrNull { it.id == id }

    fun partCatalog(): List<String> {
        val extra = j.optJSONArray("costCatalog").objects()
            .filter { it.optBoolean("technicalPart", false) && it.optBoolean("active", true) }
            .map { it.str("name") }
            .filter { it.isNotEmpty() }
        return (PART_NAMES + extra).distinct()
    }

    /** Saldo em estoque de uma peça, ou null quando a peça não tem controle de estoque. */
    fun partStock(part: String): Int? {
        val parts = j.optJSONObject("powderStock")?.optJSONObject("parts") ?: return null
        if (!parts.has(part) || parts.isNull(part)) return null
        return parts.optDouble(part, 0.0).toInt()
    }

    /** Saldo de pó químico em kg, ou null quando ainda não foi conferido. */
    fun powderBalance(agent: String): Double? {
        val stock = j.optJSONObject("powderStock") ?: return null
        if (!stock.has(agent) || stock.isNull(agent)) return null
        return stock.optDouble(agent, 0.0)
    }
}
