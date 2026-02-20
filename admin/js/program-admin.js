/**
 * Program CPT admin: logo image selector (wp.media). Loaded only on radplapag_program edit screen.
 */
(function () {
  if (typeof window.jQuery === "undefined" || typeof wp === "undefined" || !wp.media) {
    return;
  }
  window.jQuery(function ($) {
    var frame;
    $("body").on("click", ".radplapag-program-logo-select", function (e) {
      e.preventDefault();
      if (frame) {
        frame.open();
        return;
      }
      frame = wp.media({ library: { type: "image" }, multiple: false });
      frame.on("select", function () {
        var att = frame.state().get("selection").first().toJSON();
        var url = att.sizes && att.sizes.thumbnail ? att.sizes.thumbnail.url : att.url;
        $("#radplapag_program_logo_id").val(att.id);
        $(".radplapag-program-logo-preview").html(
          '<img src="' + url + '" style="max-width:128px;height:auto;">'
        );
        $(".radplapag-program-logo-remove").show();
      });
      frame.open();
    });
    $("body").on("click", ".radplapag-program-logo-remove", function (e) {
      e.preventDefault();
      $("#radplapag_program_logo_id").val("0");
      $(".radplapag-program-logo-preview").empty();
      $(".radplapag-program-logo-remove").hide();
    });
  });
})();
