/************************************************
 * Spellcaster utility for preparing the spells
 ************************************************/

class SCUPrepareSpells extends FormApplication {
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "letscontributereview",
      classes: ["scu", "prepare", "pf1", "sheet", "actor", "character"],
      title: game.i18n.localize("scu.prepareTitle"),
      template: "modules/spellcaster-utility-pf1/templates/prepare-spells.html",
      width: 650,
      height: "auto",
      closeOnSubmit: false,
      submitOnClose: false,
    });
  }
  
  async getData() {
    let data = {}

    // identify actor to render
    const tokens = canvas.tokens.controlled;
    let actors = tokens.map(o => o.actor);
    if (!actors.length) actors = game.actors.entities.filter(o => o.isPC && o.hasPerm(game.user, "OWNER"));
    actors = actors.filter(o => o.hasPerm(game.user, "OWNER"));
    if( actors.length == 0 ) { data.errorMsg = game.i18n.format("scu.errorNoActor"); return data }
    if( actors.length > 1 ) { data.errorMsg = game.i18n.format("scu.errorMultipleActors"); return data }
    const actor = actors[0]
    if( !actor.isPC ) { data.errorMsg = game.i18n.format("scu.errorInvalidActor", { 'actor' : actor.name }); return data }
    this.actor = actor
    
    // prepare spells
    this.spells = actor.data.items.filter( i => i.type == "spell" )
    let levels = {}
    this.spells.forEach( sp => {
      const lvl = sp.data.level
      if( ! levels[lvl] ) {
        levels[lvl] = { 'level': lvl, 'localize' : "PF1.SpellLevel" + lvl, 'spells': []}
      }
      let spell = duplicate(sp)
      spell.data.school = CONFIG.PF1.spellSchools[sp.data.school]
      levels[lvl]['spells'].push(duplicate(spell))
      console.log(sp)
    });
    levels = Object.values(levels).sort(function(a,b) { return a.level - b.level; })
    data.levels = levels
    
    return data
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".item-controls a").click(this._onControl.bind(this));
  }
  
  async _onControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const itemId = a.closest(".item").dataset.itemId;
    const window = this
    // retrieve spell
    let spell = this.spells.filter( i => i._id == itemId )
    if( spell.length == 0 ) return
    spell = spell[0]
    // increase / decrease
    if( a.classList.contains("spell-uses-add") ) {
      spell.data.preparation.preparedAmount += 1
    } else if( a.classList.contains("spell-uses-sub") ) {
      if( spell.data.preparation.preparedAmount == 0 ) return
      spell.data.preparation.preparedAmount -= 1
    }
    this.render()
    //const update = { _id: itemId, data: { preparation: { preparedAmount: count } } };
    //const updated = await this.actor.updateEmbeddedEntity("OwnedItem", update); // Updates one EmbeddedEntity
  }
  
}
