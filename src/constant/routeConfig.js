{
	"routes": [
	  {
		"sourceRoute": "/interface/v1/attendance/create",
		"type": "POST",
		"priority": "MUST_HAVE",
		"inSequence": false,
		"orchestrated": false,
		"targetPackages": [
		  {
			"basePackageName": "attendance",
			"packageName": "shiksha-attendance"
		  }
		]
	  },
	  {
		"sourceRoute": "/interface/v1/account/attendance/bulkAttendance",
		"type": "POST",
		"priority": "MUST_HAVE",
		"inSequence": false,
		"orchestrated": false,
		"targetPackages": [
		  {
			"basePackageName": "attendance",
			"packageName": "shiksha-attendance"
		  }
		]
	  },
      {
		"sourceRoute": "/interface/v1/account/attendance/list",
		"type": "POST",
		"priority": "MUST_HAVE",
		"inSequence": false,
		"orchestrated": false,
		"targetPackages": [
		  {
			"basePackageName": "attendance",
			"packageName": "shiksha-attendance"
		  }
		]
	  },
	  {
		"sourceRoute": "/interface/v1/account/attendance/bulkDelete",
		"type": "DELETE",
		"priority": "MUST_HAVE",
		"inSequence": false,
		"orchestrated": false,
		"targetPackages": [
		  {
			"basePackageName": "attendance",
			"packageName": "shiksha-attendance"
		  }
		]
	  }
	]
  }