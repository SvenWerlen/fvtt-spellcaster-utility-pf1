
Hooks.once("init", () => {

  console.log("Spellcaster Utility | Init")
  loadTemplates(["modules/data-toolbox/templates/prepare-spells.html"]);
  loadTemplates(["modules/data-toolbox/templates/cast-spells.html"]);
  
  //game.settings.register("data-toolbox", "source", { scope: "world", config: false, type: String, default: "modules/data-toolbox/samples/bestiary-sample.csv" });
  
//   game.settings.register("data-toolbox", "lcLogin", {
//     name: game.i18n.localize("SETTINGS.tblcLogin"), 
//     hint: game.i18n.localize("SETTINGS.tblcLoginHint"), 
//     scope: "world",
//     config: true,
//     default: "",
//     type: String});

});
