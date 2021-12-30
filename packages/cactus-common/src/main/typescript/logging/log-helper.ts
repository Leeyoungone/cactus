import { RuntimeError } from "run-time-error";

export class LogHelper {
  public static getExceptionStack(exception: unknown): string {
    // handle unknown exception input
    const defaultStack = "NO_STACK_INFORMATION_INCLUDED_IN_EXCEPTION";
    const invalidStack = "INVALID_STACK_INFORMATION";
    let stack = defaultStack;
    let exceptionHandled = false;

    // 1st need to check that exception is not null or undefined before trying to access the wanted stack information
    if (exception) {
      if (exception instanceof RuntimeError) {
        // handling RuntimeError stack inclusive nested / cascaded stacks
        stack = this.safeJsonStringify(exception);
        exceptionHandled = true;
      }

      if (!exceptionHandled && typeof exception === "object") {
        // 2nd need to check if a stack property is available
        if (Object.hasOwnProperty.call(exception, "stack")) {
          // 3rd check if the stack property is already of type string
          if (
            typeof (exception as Record<string, unknown>).stack === "string"
          ) {
            stack = (exception as { stack: string }).stack;
          } else {
            // need to stringify stack information first
            stack = this.safeJsonStringify(
              (exception as { stack: unknown }).stack,
              invalidStack,
            );
          }
        }
      }
    }
    return stack;
  }

  public static getExceptionMessage(exception: unknown): string {
    // handle unknown exception input
    const defaultMessage = "NO_MESSAGE_INCLUDED_IN_EXCEPTION";
    const invalidException = "INVALID_EXCEPTION";
    const invalidMessage = "INVALID_EXCEPTION_MESSAGE";
    const customExceptionPrefix = "A CUSTOM EXCEPTION WAS THROWN: ";
    let message = defaultMessage;
    let exceptionHandled = false;

    // 1st need to check that exception is not null or undefined before trying to access the wanted message information
    if (exception) {
      if (typeof exception === "object") {
        // 2nd need to check if a message property is available
        if (Object.hasOwnProperty.call(exception, "message")) {
          // 3rd check if the message property is already of type string
          if (
            typeof (exception as Record<string, unknown>).message === "string"
          ) {
            message = (exception as { message: string }).message;
          } else {
            // need to stringify message information first
            message = this.safeJsonStringify(
              (exception as { message: unknown }).message,
              invalidMessage,
            );
          }
          exceptionHandled = true;
        }
      }

      // handling of custom exceptions
      if (!exceptionHandled) {
        // check if thrown custom exception is a string type only -> directly use it as exception message
        if (typeof exception === "string") {
          message = exception;
        } else {
          // custom exception is of a different type -> need to stringify it
          message =
            customExceptionPrefix &&
            this.safeJsonStringify(exception, invalidException);
        }
      }
    }
    return message;
  }

  private static safeJsonStringify(
    input: unknown,
    catchMessage = "INVALID_INPUT",
  ): string {
    let message = "";

    try {
      message = JSON.stringify(input);
    } catch (error) {
      // stringify failed maybe due to cyclic dependency
      message = catchMessage;
    }
    return message;
  }
}