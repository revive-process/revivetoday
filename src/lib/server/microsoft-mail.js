import {
    getRuntimeEnv,
} from "./runtime-env.js";
import { getMicrosoftGraphToken } from "./microsoft-graph-token.js";


/* ==========================================================================
   HELPERS
   ========================================================================== */

function clean(value) {

    return String(
        value ?? ""
    ).trim();
}


function normalizeRecipients(
    recipients
) {

    if (!recipients) {
        return [];
    }


    const values =
        Array.isArray(
            recipients
        )
            ? recipients
            : [recipients];


    return values
        .map(
            (value) =>
                clean(value)
        )
        .filter(Boolean)
        .map(
            (address) => ({
                emailAddress: {
                    address,
                },
            })
        );
}


/* ==========================================================================
   GENERIC MICROSOFT GRAPH MAIL FUNCTION
   ========================================================================== */

export async function sendMicrosoftMail({

    to,

    cc = [],

    bcc = [],

    replyTo = null,

    subject,

    html,

    attachments = [],

}) {

    /* ----------------------------------------------------------------------
       CONFIG
       ---------------------------------------------------------------------- */

    const env =
        await getRuntimeEnv();


    const senderEmail =
        clean(
            env.MS_SENDER_EMAIL
        );


    if (!senderEmail) {

        throw new Error(
            "MS_SENDER_EMAIL is missing."
        );
    }


    if (!subject) {

        throw new Error(
            "Email subject is required."
        );
    }


    if (!html) {

        throw new Error(
            "Email HTML content is required."
        );
    }


    /* ----------------------------------------------------------------------
       RECIPIENTS
       ---------------------------------------------------------------------- */

    const toRecipients =
        normalizeRecipients(
            to
        );


    if (
        toRecipients.length ===
        0
    ) {

        throw new Error(
            "At least one email recipient is required."
        );
    }


    /* ----------------------------------------------------------------------
       ACCESS TOKEN
       ---------------------------------------------------------------------- */

    const accessToken =
        await getMicrosoftGraphToken();


    /* ----------------------------------------------------------------------
       MESSAGE
       ---------------------------------------------------------------------- */

    const message = {

        subject,


        body: {

            contentType:
                "HTML",

            content:
                html,
        },


        toRecipients,
    };


    /* ----------------------------------------------------------------------
       CC
       ---------------------------------------------------------------------- */

    const ccRecipients =
        normalizeRecipients(
            cc
        );


    if (
        ccRecipients.length >
        0
    ) {

        message.ccRecipients =
            ccRecipients;
    }


    /* ----------------------------------------------------------------------
       BCC
       ---------------------------------------------------------------------- */

    const bccRecipients =
        normalizeRecipients(
            bcc
        );


    if (
        bccRecipients.length >
        0
    ) {

        message.bccRecipients =
            bccRecipients;
    }


    /* ----------------------------------------------------------------------
       REPLY TO
       ---------------------------------------------------------------------- */

    const replyRecipients =
        normalizeRecipients(
            replyTo
        );


    if (
        replyRecipients.length >
        0
    ) {

        message.replyTo =
            replyRecipients;
    }


    /* ----------------------------------------------------------------------
       ATTACHMENTS
       ---------------------------------------------------------------------- */

    if (
        Array.isArray(
            attachments
        ) &&
        attachments.length >
        0
    ) {

        message.attachments =
            attachments.map(
                (attachment) => ({

                    "@odata.type":
                        "#microsoft.graph.fileAttachment",


                    name:
                        attachment.filename,


                    contentType:
                        attachment.contentType ||
                        "application/octet-stream",


                    contentBytes:
                        attachment.contentBase64,
                })
            );
    }


    /* ----------------------------------------------------------------------
       GRAPH URL
       ---------------------------------------------------------------------- */

    const graphUrl =

        "https://graph.microsoft.com/v1.0/users/" +

        encodeURIComponent(
            senderEmail
        ) +

        "/sendMail";


    /* ----------------------------------------------------------------------
       SEND
       ---------------------------------------------------------------------- */

    const response =
        await fetch(
            graphUrl,
            {

                method:
                    "POST",


                headers: {

                    Authorization:
                        `Bearer ${accessToken}`,


                    "Content-Type":
                        "application/json",
                },


                body:
                    JSON.stringify(
                        {

                            message,


                            saveToSentItems:
                                true,
                        }
                    ),
            }
        );


    /* ----------------------------------------------------------------------
       ERROR
       ---------------------------------------------------------------------- */

    if (!response.ok) {

        const errorText =
            await response.text();


        console.error(
            "Microsoft Graph sendMail failed:",
            {

                status:
                    response.status,


                statusText:
                    response.statusText,


                senderEmail,


                to:
                    toRecipients.map(
                        (recipient) =>
                            recipient
                                .emailAddress
                                .address
                    ),


                response:
                    errorText,
            }
        );


        throw new Error(
            `Microsoft Graph sendMail failed (${response.status}): ${errorText}`
        );
    }


    /* ----------------------------------------------------------------------
       SUCCESS
       ---------------------------------------------------------------------- */

    return {

        success:
            true,
    };
}