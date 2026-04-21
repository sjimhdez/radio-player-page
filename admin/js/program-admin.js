/**
 * Program and Station CPT admin: logo/image selector (wp.media).
 * Uses .radplapag-program-logo-wrapper so one or multiple blocks (e.g. station logo + background) work.
 * Loaded on radplapag_program and radplapag_station edit screens.
 */
(function () {
  if (typeof window.jQuery === "undefined" || typeof wp === "undefined" || !wp.media) {
    return;
  }
  window.jQuery(function ($) {
    var frame;
    var currentWrapper;
    $("body").on("click", ".radplapag-program-logo-select", function (e) {
      e.preventDefault();
      currentWrapper = $(e.target).closest(".radplapag-program-logo-wrapper");
      if (!currentWrapper.length) return;
      if (frame) {
        frame.open();
        return;
      }
      frame = wp.media({ library: { type: "image" }, multiple: false });
      frame.on("select", function () {
        if (!currentWrapper || !currentWrapper.length) return;
        var att = frame.state().get("selection").first().toJSON();
        var url = (att.sizes && att.sizes.medium && att.sizes.medium.url) ? att.sizes.medium.url : att.url;
        currentWrapper.find(".radplapag-program-logo-id").val(att.id);
        currentWrapper.find(".radplapag-program-logo-preview").html(
          '<img src="' + url + '" alt="">'
        );
        currentWrapper.find(".radplapag-program-logo-remove").show();
      });
      frame.open();
    });
    $("body").on("click", ".radplapag-program-logo-remove", function (e) {
      e.preventDefault();
      var wrapper = $(e.target).closest(".radplapag-program-logo-wrapper");
      if (!wrapper.length) return;
      wrapper.find(".radplapag-program-logo-id").val("");
      wrapper.find(".radplapag-program-logo-preview").empty();
      wrapper.find(".radplapag-program-logo-remove").hide();
    });
  });
})();
