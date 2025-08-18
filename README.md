# require : npm install chokidar dotenv 
# require : npm install chokidar dotenv 
# require : npm install chokidar dotenv 

# file-tracker
File Tracker est un script Node.js qui surveille en temps réel l’activité des fichiers sur ton PC (création, modification, suppression, ajout de dossier). Il génère des logs journaliers et peut envoyer des alertes Discord pour certains événements suspects.

" ca c chat gpt "
# ⚙️ Fonctionnalités

🔎 Surveillance en direct des dossiers (par défaut : Downloads, Desktop, Documents, Startup).

📝 Sauvegarde des événements dans des logs NDJSON (un fichier par jour).

🔒 Calcul automatique du hash SHA-256 pour les fichiers de petite taille (≤ 10 Mo).

🚨 Alertes Discord en cas de :

Création de fichiers .exe, .dll, .bat, .ps1, .lnk dans Downloads ou Startup.

Tout nouveau fichier placé dans le dossier Startup.

🛑 Détection de suppressions massives (alerte si +10 fichiers supprimés en 30s).

⚡ Configuration simple via config.json et .env

# ENJOY 
# DISCORD : .krns
