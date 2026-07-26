# Electron Movie Tracker

This Electron-based application helps you build and maintain a personal "watched movies" list.

## Overview & Purpose  
- Persist movie data locally in a JSON file  
- Search The Movie Database (TMDB) for titles  
- Record details (rating, watch date, format, rewatch status)  
- Filter & sort your collection by year, genre, director, format, rating, or date  
- View full details with external links to IMDb & Letterboxd  
- Sync your latest activity automatically from your Letterboxd account
- **Development & Production Modes** for safe testing

## Documentation

The documentation has been split into several specific files for easier reading:

1. **[Architecture & Data Flow](../docs/ARCHITECTURE.md)**
   - MVC Structure
   - Module Responsibilities
   - Data Flow and IPC Interactions

2. **[Setup & Development](../docs/DEVELOPMENT.md)**
   - Installation Instructions
   - Running in Dev & Prod Modes
   - Building Windows Installers
   - Testing with Jest
   - Automated Updates (CI/CD)

3. **[Features & Usage](../docs/FEATURES.md)**
   - Usage Examples (Adding, Editing, Filtering)
   - Error Handling & Edge Cases
   - Future Improvements

4. **[Letterboxd Sync Integration](../docs/LETTERBOXD_SYNC.md)**
   - How the 1-way Letterboxd Sync works
   - Backend Architecture & RSS Parsing
   - High-Water Mark Logic (last 50 movies via RSS)

Enjoy maintaining your personal movie library with this Electron tracker!
