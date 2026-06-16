if (!window.createAtelierFileStorage) {
  throw new Error("Fabrique commune createAtelierFileStorage non chargée");
}

window.WordAtelierFileStorage = window.createAtelierFileStorage({
  dbName: "word_atelier_fs_settings_v1",
  pickerIds: {
    userFolder: "word-atelier-user-folder",
    userFolderOpen: "word-atelier-user-folder-open",
    documentsRoot: "word-atelier-documents-root",
    scanRoot: "word-atelier-scan-root",
  },
  progressFileName: "progression-word.json",
  workFilePickerDescription: "Document Word",
  workFileAccept: {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    "application/msword": [".doc"],
  },
  defaultWorkFileName: "fichier.docx",
});
