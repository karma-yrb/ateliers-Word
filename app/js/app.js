const data = window.WORD_ATELIER_DATA;
if (!data) {
  throw new Error("Données WORD_ATELIER_DATA introuvables");
}

const ModelClass = window.WordAtelierModel;
const ViewClass = window.WordAtelierView;
const StorageClass = window.WordAtelierFileStorage;
const ControllerClass = window.WordAtelierController;
if (!ModelClass || !ViewClass || !StorageClass || !ControllerClass) {
  throw new Error("Classes application non chargées");
}

const model = new ModelClass(data);
const view = new ViewClass();
const storage = new StorageClass();
const controller = new ControllerClass(model, view, storage);

controller.init();
