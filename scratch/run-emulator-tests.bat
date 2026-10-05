@echo off
set JAVA_HOME=C:\Users\nanon\jdk21_java\jdk-21.0.12.1+1
set PATH=C:\Users\nanon\jdk21_java\jdk-21.0.12.1+1\bin;%PATH%
call npx firebase emulators:exec --only firestore "npx tsx scripts/test-firestore-rules-official.ts"
