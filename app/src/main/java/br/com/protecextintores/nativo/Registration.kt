package br.com.protecextintores.nativo

import org.json.JSONArray
import org.json.JSONObject
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate
import java.time.YearMonth
import java.util.UUID

internal val registrationGroups = listOf("items", "soldExtinguishers", "plannedParts", "hydrantHoses", "complementaryServices")

internal fun newRegistrationDraft(): JSONObject = JSONObject()
    .put("serviceId", UUID.randomUUID().toString())
    .put("clientChoice", "__self__")
    .put("date", LocalDate.now().toString())
    .put("step", 0)

internal class RegistrationCatalog(val context: JSONObject) {
    val data = context.optJSONObject("registrationCatalog") ?: JSONObject()
    val contacts = context.optJSONObject("registrationContacts") ?: JSONObject()
    val equipment = data.optJSONArray("equipment").objects()
    val complements = data.optJSONArray("complements").objects()
    val parts = data.optJSONArray("parts").objects()
    val sales = data.optJSONArray("sales").objects()
    val conditions = data.optJSONArray("saleConditions").objects()
    val actorName = context.optJSONObject("actor")?.str("name").orEmpty()
    val account = context.str("accountKey")
    val epoch = context.str("dataEpoch").ifBlank { "initial" }

    fun options(key: String): List<String> = data.optJSONArray(key).strings()

    fun validate(draft: JSONObject, step: Int): String? {
        if (step == 0 || step == 3) {
            val choice = draft.str("clientChoice")
            if (choice == "__new__") {
                if (draft.str("clientName").trim().length !in 2..100) return "Informe o nome do cliente."
                val phone = draft.str("clientPhone").trim()
                val email = draft.str("clientEmail").trim()
                if (phone.isNotEmpty() && !phone.matches(Regex("""\+?[\d\s().-]{8,30}"""))) return "Confira o telefone do cliente."
                if (email.isNotEmpty() && !email.matches(Regex("""[^\s@]+@[^\s@]+\.[^\s@]+"""))) return "Confira o e-mail do cliente."
            } else if (choice !in listOf("", "__self__") && contacts.optJSONArray("clients").objects().none { it.str("id") == choice }) {
                return "O cliente selecionado saiu do catálogo. Selecione outro."
            }
            val seller = draft.str("sellerChoice")
            if (seller.isNotEmpty() && contacts.optJSONArray("sellers").objects().none { it.str("id") == seller }) {
                return "O vendedor selecionado saiu do catálogo. Selecione outro."
            }
        }
        if (step >= 1) {
            val groups = if (step == 1) registrationGroups.take(2)
                else if (step == 2) registrationGroups.drop(2) else registrationGroups
            for (group in groups) {
                val lines = draft.optJSONArray(group).objects()
                if (lines.size > 50) return "Use até 50 grupos por seção."
                if (group in registrationGroups.take(2) && lines.sumOf { quantity(group, it) } > 100) {
                    return "Use até 100 extintores por seção."
                }
                val max = if (group == "complementaryServices") 100 else 50
                if (lines.any { quantity(group, it) !in 1..max || !validRow(group, it) }) {
                    return "Confira os campos e as quantidades na seção ${registrationLabel(group).lowercase()}."
                }
            }
        }
        if (step == 3) {
            if (registrationGroups.filterNot { it == "plannedParts" }.none { draft.optJSONArray(it).objects().isNotEmpty() }) {
                return "Adicione manutenção, fornecimento ou um serviço complementar."
            }
            val date = draft.str("date")
            if (!date.matches(Regex("""\d{4}-\d{2}-\d{2}""")) || runCatching { LocalDate.parse(date) }.isFailure) {
                return "Confira a data do serviço (AAAA-MM-DD)."
            }
            val next = draft.str("nextMaintenanceMonth")
            if (next.isNotBlank() && (!next.matches(Regex("""20\d{2}-\d{2}""")) || runCatching { YearMonth.parse(next) }.isFailure)) {
                return "Confira o mês da próxima manutenção (AAAA-MM)."
            }
            val amount = draft.str("serviceAmount").trim()
            if (amount.isNotEmpty() && (parseAmount(amount)?.let { it >= BigDecimal.ZERO && it <= BigDecimal("1000000") } != true)) {
                return "Confira o valor combinado."
            }
        }
        return null
    }

    private fun validRow(group: String, row: JSONObject): Boolean = when (group) {
        "items", "soldExtinguishers" -> equipment.any {
            it.str("type") == row.str("type") && it.str("kg") == row.str("kg") &&
                (group != "items" || it.optBoolean("maintenanceAllowed", true))
        } && (group == "items" || conditions.any { it.str("value") == row.str("condition") })
        "plannedParts" -> parts.any { it.str("name") == row.str("name") }
        "hydrantHoses" -> complements.any { it.str("id") == "hydrant-hose-test" } &&
            listOf("type" to "hoseTypes", "diameterMm" to "diameters", "lengthMeters" to "lengths").all { (field, key) ->
                row.str(field) in options(key)
            }
        else -> {
            val complement = complements.firstOrNull {
                it.str("id") == row.str("catalogId") && it.str("placement") != "equipment"
            }
            complement != null && row.str("variant") in complement.optJSONArray("variants").stringList() &&
                complement.optJSONArray("fields").objects().all {
                    row.optJSONObject("parameters")?.str(it.str("key")) in it.optJSONArray("values").stringList()
                }
        }
    }

    fun payload(draft: JSONObject, isAdmin: Boolean): JSONObject {
        val hasEquipment = draft.optJSONArray("items").objects().isNotEmpty()
        val hasSales = draft.optJSONArray("soldExtinguishers").objects().isNotEmpty()
        val type = if (hasEquipment || !hasSales) "Manutenção"
            else if ("Compra de extintores" in options("services")) "Compra de extintores" else "Fornecimento de extintores"
        return JSONObject().apply {
            put("workshopVersion", 44)
            put("registrationVersion", 8)
            put("serviceType", type)
            put("maintenanceEnabled", hasEquipment)
            for (key in listOf("serviceId", "clientChoice", "clientName", "clientPhone", "clientEmail", "date", "nextMaintenanceMonth", "notes")) {
                put(key, draft.str(key).trim())
            }
            put("sellerChoice", if (isAdmin) draft.str("sellerChoice") else "")
            put("serviceAmount", parseAmount(draft.str("serviceAmount"))?.toPlainString().orEmpty())
            for (group in registrationGroups) {
                val lines = draft.optJSONArray(group).objects().map { line ->
                    JSONObject(line.toString()).apply {
                        val countField = if (group == "items") "qty" else "quantity"
                        put(countField, optInt(countField))
                        if (group == "hydrantHoses") {
                            put("diameterMm", optInt("diameterMm"))
                            put("lengthMeters", optInt("lengthMeters"))
                        }
                    }
                }
                put(group, JSONArray(lines))
            }
        }
    }

    data class QuoteLine(val label: String, val count: Int, val cents: Long?)

    fun quote(draft: JSONObject): List<QuoteLine> = registrationGroups.flatMap { group ->
        draft.optJSONArray(group).objects().map { item ->
            val config = when (group) {
                "items" -> equipment.firstOrNull { matchesType(it, item) }
                "soldExtinguishers" -> sales.firstOrNull { matchesType(it, item) && it.str("condition") == item.str("condition") }
                "plannedParts" -> parts.firstOrNull { it.str("name") == item.str("name") }
                "complementaryServices" -> complements.firstOrNull { it.str("id") == item.str("catalogId") }
                else -> null
            }
            val price = when (group) {
                "hydrantHoses" -> data.optJSONObject("hosePrices")?.opt("${item.str("type")}|${item.str("lengthMeters")}")
                    ?: data.opt("hoseDefaultPrice")
                "complementaryServices" -> config?.optJSONObject("prices")?.opt(item.str("variant"))
                else -> config?.opt("price")
            }
            val label = when (group) {
                "items", "soldExtinguishers" -> listOfNotNull(
                    item.str("type"), config?.str("label"),
                    conditions.firstOrNull { it.str("value") == item.str("condition") }?.str("label")
                ).filter { it.isNotBlank() }.joinToString(" · ")
                "plannedParts" -> item.str("name")
                "hydrantHoses" -> "Mangueira · ${item.str("type")} · ${item.str("diameterMm")} mm · ${item.str("lengthMeters")} m"
                else -> "${config?.str("name").orEmpty()} · ${item.str("variant")}"
            }
            QuoteLine(label, quantity(group, item), price?.toString()?.toBigDecimalOrNull()
                ?.setScale(2, RoundingMode.HALF_UP)?.movePointRight(2)?.toLong())
        }
    }

    private fun matchesType(entry: JSONObject, item: JSONObject) =
        entry.str("type") == item.str("type") && entry.str("kg") == item.str("kg")
}

private fun parseAmount(value: String) = value.trim().replace(',', '.').takeIf {
    it.matches(Regex("""\d+(\.\d{1,2})?"""))
}?.toBigDecimalOrNull()

private fun quantity(group: String, row: JSONObject) = row.optInt(if (group == "items") "qty" else "quantity")

internal fun registrationLabel(group: String) = when (group) {
    "items" -> "Extintores para manutenção"
    "soldExtinguishers" -> "Compra de extintores"
    "plannedParts" -> "Peças previstas"
    "hydrantHoses" -> "Teste de mangueiras de hidrante"
    else -> "Serviços complementares"
}

internal fun JSONArray?.stringList(): List<String> =
    if (this == null) emptyList() else (0 until length()).map { optString(it) }
