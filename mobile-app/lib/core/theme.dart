import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Shared design tokens, matching the web app design system exactly so the
/// Android app and the web app feel like the same product.
class AppColors {
  static const background = Color(0xFFF8F8F8);
  static const surface = Color(0xFFFFFFFF);
  static const ink = Color(0xFF2B2B2B);
  static const inkDeep = Color(0xFF0B0B0B);
  static const textPrimary = Color(0xFF232323);
  static const textSecondary = Color(0xFF9A9A9A);
  static const placeholder = Color(0xFFB3B3B3);
  static const track = Color(0xFFE9E9E9);
  static const onInk = Color(0xFFFFFFFF);
  static const thumbBackground = Color(0xFFF4F4F4);
}

ThemeData buildAppTheme() {
  final base = ThemeData.light(useMaterial3: true);
  final textTheme = GoogleFonts.montserratTextTheme(base.textTheme).apply(
    bodyColor: AppColors.textPrimary,
    displayColor: AppColors.textPrimary,
  );

  return base.copyWith(
    scaffoldBackgroundColor: AppColors.background,
    primaryColor: AppColors.ink,
    textTheme: textTheme,
    colorScheme: base.colorScheme.copyWith(
      primary: AppColors.ink,
      surface: AppColors.surface,
    ),
    cardTheme: CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      shadowColor: Colors.black.withValues(alpha: 0.06),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.ink,
        foregroundColor: AppColors.onInk,
        minimumSize: const Size(327, 60),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        textStyle: GoogleFonts.montserrat(fontSize: 14, fontWeight: FontWeight.w500),
        elevation: 0,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.thumbBackground,
      hintStyle: GoogleFonts.montserrat(color: AppColors.placeholder, fontSize: 14),
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(25), borderSide: BorderSide.none),
    ),
  );
}
