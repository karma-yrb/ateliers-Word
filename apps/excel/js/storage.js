if (!window.createAtelierFileStorage) {
  throw new Error("Fabrique commune createAtelierFileStorage non chargée");
}

window.ExcelAtelierFileStorage = window.createAtelierFileStorage({
  dbName: "excel_atelier_fs_settings_v1",
  pickerIds: {
    userFolder: "excel-atelier-user-folder",
    userFolderOpen: "excel-atelier-user-folder-open",
    documentsRoot: "excel-atelier-documents-root",
    scanRoot: "excel-atelier-scan-root",
  },
  progressFileName: "progression-excel.json",
  workFilePickerDescription: "Classeur Excel",
  workFileAccept: {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    "application/vnd.ms-excel": [".xls"],
  },
  defaultWorkFileName: "fichier.xlsx",
});
