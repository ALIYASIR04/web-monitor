var updateCheckState = function(check) {
  var html = '';
  if (typeof check.isUp == 'undefined') {
    if (check.lastTested) {
      
      html += '<span class="label label-info">unknown</span>';
    } else {
      html += '<span class="label label-important">down</span> <span class="label label-warning">new</span>';
    }
  } else {
    var status = {};
    if (check.isUp) {
      // up
      status.label = 'success';
      status.color = 'green';
      status.text = 'OK';
      status.date = check.lastChanged;
    } else {
      // down
      status.label = 'important';
      status.color = 'red';
      status.text = 'KO';
      status.date = check.lastChanged;
    }
    html += 'Site Status :<span class="label label-' + status.label + '">' +  status.text +'</span>';
  }
  $('#check_24h').html(html);
}