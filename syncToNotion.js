// Script properties for secure key storage
const NOTION_TOKEN = PropertiesService.getScriptProperties().getProperty('NOTION_TOKEN');
const NOTION_DATABASE_ID = PropertiesService.getScriptProperties().getProperty('NOTION_DATABASE_ID');
const DRIVE_FOLDER_ID = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');

const GMAIL_LABEL_NAME = 'NotionToSync';
const SYNCED_LABEL = 'SyncedToNotion';

const gmailToNotion = () => {
  const label = GmailApp.getUserLabelByName(GMAIL_LABEL_NAME);
  const successLabel = GmailApp.getUserLabelByName(SYNCED_LABEL);

  // Check if labels exist
  if (!label || !successLabel) {
    Logger.log('One or both specified labels do not exist.');
    return;
  }

  const threads = label.getThreads(0, 10);
  threads.forEach((thread) => {
    try {
      const [message] = thread.getMessages().reverse();
      postToNotion(message);
      thread.removeLabel(label);
      thread.addLabel(successLabel);
    } catch (error) {
      Logger.log(`Error processing thread: ${error.message}. Stack Trace: ${error.stack}`);
    }
  });
};

// Main Function 
function postToNotion(message) {
  const url = 'https://api.notion.com/v1/pages';
  
  // Initialize an array to store attachment URLs
  let attachmentURLs = [];

  // Handle attachments
  const attachments = message.getAttachments();
  attachments.forEach(attachment => {
    const file = DriveApp.getFolderById(DRIVE_FOLDER_ID).createFile(attachment);
    
    // Optional: Set the file sharing to public
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Save the file URL
    attachmentURLs.push(file.getUrl());
  });

  // Construct the body for the Notion API request
  const body = {
    parent: {
      type: "database_id",
      database_id: NOTION_DATABASE_ID,
    },
    icon: {
      type: "emoji",
      emoji: "📝"
    },
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: message.getPlainBody()
              },
            },
          ],
        },
      }
    ],
    properties: {
      Name: {
        title: [
          {
            text: {
              content: message.getSubject(),
            },
          },
        ],
      },
      // Add the attachment URL property
      URL: {
        type: 'url',
        url: attachmentURLs.join(", "), // Join multiple URLs with a comma
      },
    },
  };

  // Post to Notion
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: "application/json",
      muteHttpExceptions: false,
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-02-22'
      },
      payload: JSON.stringify(body)
    });

    if (response.getResponseCode() !== 200) {
      throw new Error(`Failed to post to Notion. Response: ${response.getContentText()}`);
    }
  } catch (error) {
    Logger.log(`Error posting to Notion: ${error.message}`);
    throw error; // Re-throw for higher-level handling
  }
}