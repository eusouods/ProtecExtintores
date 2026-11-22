package br.com.protecextintores.nativo

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF226B99),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFDCE9F3),
    onPrimaryContainer = Color(0xFF20374A),
    secondary = Color(0xFF526B80),
    onSecondary = Color(0xFFFFFFFF),
    background = Color(0xFFEDF4FA),
    onBackground = Color(0xFF20374A),
    surface = Color(0xFFF9FCFF),
    onSurface = Color(0xFF20374A),
    surfaceVariant = Color(0xFFDCE9F3),
    onSurfaceVariant = Color(0xFF526B80),
    outline = Color(0xFFC5D8E6),
    outlineVariant = Color(0xFFC5D8E6),
    error = Color(0xFFB3261E),
    onError = Color(0xFFFFFFFF)
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF8EC8ED),
    onPrimary = Color(0xFF102838),
    primaryContainer = Color(0xFF1D455D),
    onPrimaryContainer = Color(0xFFFFFFFF),
    secondary = Color(0xFFB9D7E8),
    onSecondary = Color(0xFF102838),
    background = Color(0xFF10202C),
    onBackground = Color(0xFFFFFFFF),
    surface = Color(0xFF162C3B),
    onSurface = Color(0xFFFFFFFF),
    surfaceVariant = Color(0xFF1D455D),
    onSurfaceVariant = Color(0xFFB4C9D7),
    outline = Color(0xFF36566A),
    outlineVariant = Color(0xFF36566A),
    error = Color(0xFFFF8A80),
    onError = Color(0xFF0F131F)
)

@Composable
fun ProtecTheme(mode: String, content: @Composable () -> Unit) {
    val dark = when (mode) {
        "dark" -> true
        "light" -> false
        else -> isSystemInDarkTheme()
    }
    MaterialTheme(colorScheme = if (dark) DarkColors else LightColors, content = content)
}
