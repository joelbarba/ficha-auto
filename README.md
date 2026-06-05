# 🕒 Ficha-Auto

Fitxatge automàtic a [Ficha.Work](https://app.ficha.work) mitjançant **GitHub Actions**. El sistema s'executa automàticament de dilluns a divendres a les **09:00** (entrada) i a les **17:00** (sortida), sense necessitat de tenir l'ordinador encès.

## ✨ Característiques
* 🚫 **Intel·ligent:** Salta automàticament els dies festius del calendari de la teva empresa.
* 🌴 **Vacances:** Respecta els dies de vacances registrats a Ficha.Work.
* 🔄 **Autosuficient:** El token de sessió es renova automàticament en cada execució.
* 📋 **Transparent:** Registres (logs) detallats de cada fitxatge a la pestanya *Actions*.

---

## 🚀 Tutorial: Com configurar-ho al teu compte

Segueix aquests passos per tenir el teu propi sistema de fitxatge en menys de 5 minuts:

### Pas 1: Preparar el teu repositori
1. Inicia sessió al teu compte de [GitHub](https://github.com).
2. Fes un **Fork** d'aquest repositori (botó a la part superior dreta).
3. Deixa les opcions per defecte i fes clic a **Create fork**. Ara ja tens una còpia privada al teu compte.

### Pas 2: Configurar el Secret a GitHub
1. Al **teu** repositori (el fork), ves a la pestanya **Settings**.
2. Al menú esquerre, ves a **Secrets and variables** → **Actions**.
3. Fes clic a **New repository secret**.
4. **Name:** `USER`
5. **Secret:** Introdueix el teu usuari.
6. Fes clic a **Add secret**.
7. Fes clic a **New repository secret**.
8. **Name:** `PASS`
9. **Secret:** Introdueix el teu password.
10. Fes clic a **Add secret**.

### Pas 3: Activar els Workflows
GitHub desactiva les accions per defecte quan fas un fork. Per activar-les:
1. Ves a la pestanya **Actions** del teu repositori.
2. Fes clic al botó verd: **"I understand my workflows, go ahead and enable them"**.

### Pas 4: Prova de funcionament
1. Dins de la pestanya **Actions**, selecciona el flux **Fichaje automático** a la llista de l'esquerra.
2. Fes clic al desplegable **Run workflow** → botó **Run workflow**.
3. Espera uns segons, recarrega la pàgina i fes clic a l'execució per veure els logs i confirmar que ha funcionat correctament.

---

## ⏰ Ajust d'horari (UTC)

GitHub Actions treballa sempre amb l'hora **UTC**. Perquè fitxi a les 09:00 i 17:00 de Madrid/Barcelona, el fitxer `.github/workflows/fichar.yml` s'ha de configurar segons l'època de l'any:

| Època | Diferència local | Configuració Cron |
| :--- | :--- | :--- |
| **Estiu** (Març-Octubre) | UTC+2 | `0 7` (9:00) i `0 15` (17:00) |
| **Hivern** (Octubre-Març) | UTC+1 | `0 8` (9:00) i `0 16` (17:00) |

> [!TIP]
> Per editar-ho, obre el fitxer `.yml`, prem l'icona del llapis ✏️, canvia les hores i fes clic a **Commit changes**.

---

## 🛠️ Manteniment
* **Si deixa de funcionar:** El més probable és que el `refreshToken` hagi caducat per falta d'ús prolongat. Repeteix els **Passos 2 i 3** amb un nou token.
* **Logs:** Sempre pots revisar la pestanya **Actions** per verificar si el fitxatge d'avui s'ha realitzat amb èxit.
