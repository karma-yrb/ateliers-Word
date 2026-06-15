const data = window.EXCEL_ATELIER_DATA;
if (!data) {
  throw new Error("Données EXCEL_ATELIER_DATA introuvables");
}

const ModelClass = window.ExcelAtelierModel;
const ViewClass = window.ExcelAtelierView;
const StorageClass = window.ExcelAtelierFileStorage;
const ControllerClass = window.ExcelAtelierController;
if (!ModelClass || !ViewClass || !StorageClass || !ControllerClass) {
  throw new Error("Classes application non chargées");
}

const model = new ModelClass(data);
const view = new ViewClass();
const storage = new StorageClass();
const controller = new ControllerClass(model, view, storage);

controller.init();
