package br.com.protecextintores.nativo

import org.json.JSONArray
import org.json.JSONObject

/** Lê um texto do JSON sem devolver a palavra "null" quando o campo é nulo ou não existe. */
fun JSONObject.str(key: String): String = if (isNull(key)) "" else optString(key, "")

fun JSONArray?.objects(): List<JSONObject> {
    if (this == null) return emptyList()
    val out = ArrayList<JSONObject>()
    for (i in 0 until length()) {
        val o = optJSONObject(i)
        if (o != null) out.add(o)
    }
    return out
}

fun JSONArray?.strings(): List<String> {
    if (this == null) return emptyList()
    val out = ArrayList<String>()
    for (i in 0 until length()) {
        val s = optString(i, "")
        if (s.isNotEmpty()) out.add(s)
    }
    return out
}

fun jsonArrayOf(items: List<String>): JSONArray {
    val array = JSONArray()
    for (item in items) array.put(item)
    return array
}
