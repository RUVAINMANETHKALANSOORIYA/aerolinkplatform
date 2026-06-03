import logging
import os

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

cognito = boto3.client("cognito-idp")

PASSENGER_GROUP_NAME = os.environ.get("PASSENGER_GROUP_NAME", "Passenger")
ALLOWED_APP_CLIENT_ID = os.environ["ALLOWED_APP_CLIENT_ID"]


def lambda_handler(event, context):
    """
    Assign only newly self-confirmed public registrations to the Passenger group.
    Staff accounts must never be assigned through public signup.
    """
    trigger_source = event.get("triggerSource", "")
    client_id = event.get("callerContext", {}).get("clientId")

    if trigger_source != "PostConfirmation_ConfirmSignUp":
        logger.info("Skipped non-signup post-confirmation trigger.")
        return event

    if client_id != ALLOWED_APP_CLIENT_ID:
        logger.warning("Skipped signup confirmation from unexpected app client.")
        return event

    user_pool_id = event["userPoolId"]
    username = event["userName"]

    cognito.admin_add_user_to_group(
        UserPoolId=user_pool_id,
        Username=username,
        GroupName=PASSENGER_GROUP_NAME,
    )

    logger.info("Confirmed public signup assigned to Passenger group.")
    return event
